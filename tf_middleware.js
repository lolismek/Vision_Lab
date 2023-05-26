const tf = require('@tensorflow/tfjs-node');

async function trainModel(xTrain, yTrain, learningRate, _epochs){
    for(let arr in xTrain){
        for(let el in xTrain){
            if(Number.isNaN(xTrain[arr][el])){
                xTrain[arr][el] = 0;
            }
        }
    }

    for(let el in yTrain){
        if(Number.isNaN(yTrain[el])){
            yTrain[el] = 0;
        }
    }

    const xTrainTensor = tf.tensor2d(xTrain).cast('float32');
    const yTrainTensor = tf.tensor2d(yTrain, [yTrain.length, 1]).cast('float32');

    const validationSplit = 0.1;
    const [xTrainNorm, yTrainNorm, xValNorm, yValNorm] = tf.tidy(() => {
        const range = tf.sub(xTrainTensor.max(), xTrainTensor.min());
        const denom = tf.add(range, tf.scalar(1e-6)); // avoid division by 0?
        const xTrainNorm = tf.div(tf.sub(xTrainTensor, xTrainTensor.min()), tf.sub(xTrainTensor.max(), xTrainTensor.min()), denom);
        const yTrainNorm = tf.div(tf.sub(yTrainTensor, yTrainTensor.min()), tf.sub(yTrainTensor.max(), yTrainTensor.min()), denom);

        const [xTrainNormT, xValNormT] = tf.split(xTrainNorm, [Math.floor(xTrain.length * (1 - validationSplit)), xTrain.length - Math.floor(xTrain.length * (1 - validationSplit))]);
        const [yTrainNormT, yValNormT] = tf.split(yTrainNorm, [Math.floor(yTrain.length * (1 - validationSplit)), yTrain.length - Math.floor(yTrain.length * (1 - validationSplit))]);

        return [xTrainNormT, yTrainNormT, xValNormT, yValNormT];
    });

    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 64, inputShape: [xTrain[0].length], activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 1 }));

    // it's better to have a smaller learning rate for little ammount of data
    //const learningRate = 0.001; 
    const optimizer = tf.train.adam(learningRate);
    model.compile({loss: 'meanSquaredError', optimizer: optimizer});

    const history = await model.fit(xTrainNorm, yTrainNorm, {
        batchSize: Math.min(32, Math.floor(xTrain.length * (1 - validationSplit))),
        epochs: _epochs,
        validationData: [xValNorm, yValNorm],
        verbose: 0
    });

    const valLoss = history.history.val_loss[history.history.val_loss.length - 1];

    let result = await model.save(tf.io.withSaveHandler(async modelArtifacts => modelArtifacts));
    result.weightData = Buffer.from(result.weightData).toString("base64");
    const jsonStr = JSON.stringify(result);
    const buff = Buffer.from(jsonStr, 'utf-8'); 

    let minX = [];
    let maxX = [];
    let minY;
    let maxY;

    for (let col = 0; col < xTrain[0].length; col++) {
        minX.push(xTrain[0][col]);
        maxX.push(xTrain[0][col]);
    }
    for (let lin = 1; lin < xTrain.length; lin++) {
        for (let col = 0; col < xTrain[lin].length; col++) {
            minX[col] = Math.min(minX[col], xTrain[lin][col]);
            maxX[col] = Math.max(maxX[col], xTrain[lin][col]);
        }
    }

    minY = maxY = yTrain[0];
    for (let col = 1; col < yTrain.length; col++) {
        minY = Math.min(minY, yTrain[col]);
        maxY = Math.max(maxY, yTrain[col]);
    }

    return {model: model, valLoss: valLoss, buff: buff, minX: minX, maxX: maxX, minY: minY, maxY: maxY};
}

async function getPredict(modelBuffer, minX, maxX, minY, maxY, xTest){
    let modelStr = modelBuffer.toString('utf-8');
    const json = JSON.parse(modelStr);
    const weightData = new Uint8Array(Buffer.from(json.weightData, "base64")).buffer;
    const model = await tf.loadLayersModel(tf.io.fromMemory({modelTopology: json.modelTopology, weightSpecs: json.weightSpecs, weightData: weightData}));

    let xTestNorm = [...xTest];

    // normalize and tensorize input value (denormalize output => return it)
    for(let i = 0; i < xTestNorm.length; i++){
        xTestNorm[i] = (xTestNorm[i] - minX[i]) / (maxX[i] - minX[i] + (1e-6));
    }

    let xTestTensor = tf.tensor2d([xTestNorm]).cast('float32');
    let pred = model.predict(xTestTensor).arraySync();
    pred *= (maxY - minY + (1e-6));
    pred += minY;
    
    return pred;
}

module.exports = {trainModel, getPredict};
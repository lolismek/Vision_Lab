const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const plotSchema = new Schema({
    projectId: {
        type: String,
        required: true
    },
    name: {
        type: String, 
        required: true
    },
    xAxisName: {
        type: String,
        required: true
    },
    yAxisName: {
        type: String,
        required: true
    },
    connect: {
        type: Boolean,
        required: true
    },
    image: {
        type: String
    }
}, {timestamps: true});

const Plot = mongoose.model('Plot', plotSchema);
module.exports = Plot;
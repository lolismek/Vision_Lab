const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const modelSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    modelBuffer: {
        type: Buffer,
        required: true
    },
    minX: {
        type: [Number],
        required: true
    },
    maxX: {
        type: [Number],
        required: true
    },
    minY: {
        type: Number,
        required: true
    },
    maxY: {
        type: Number,
        required: true
    },
    xcol: {
        type: [String],
        required: true
    },
    ycol: {
        type: String,
        required: true
    },
    log: {
        type: [{
            x: {
                type: [Number],
                required: true
            },
            y: {
                type: Number,
                required: true
            }
        }]
    },
    projectId: {
        type: String,
        required: true
    }
}, {timestamps: true});

const Model = mongoose.model('model', modelSchema);
module.exports = Model;
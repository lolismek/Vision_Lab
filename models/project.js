const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const projectSchema = new Schema({
    name: {
        type: String,
        requried: true
    },
    private: {
        type: Boolean,
        required: true
    },
    visible: {
        type: Boolean,
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    data: {
        type: Buffer,
        required: true
    },
    collumns: {
        type: [String],
        required: true
    },
    datatypes: {
        type: [String],
        required: true
    },
    dataMatrix: {
        type: [[String]],
        required: true
    },
    editors: {
        type: [String],
        required: true
    },
    plotsIds: {
        type: [String]
    },
    plotsNames:{
        type: [String]
    },
    modelIds: {
        type: [String]
    },
    modelNames: {
        type: [String]
    },
    boxIds: {
        type: [String]
    },
    desc: {
        type: String
    }
}, {timestamps: true})

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
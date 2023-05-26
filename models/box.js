const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const boxSchema = new Schema({
    projectId: {
        type: {
            id: {
                type: String,
                required: true
            },
            branch: {
                type: String,
                required: true
            }
        },
        required: true
    },
    content: {
        type: String
    }
}, {timestamps: true});

const Box = mongoose.model('box', boxSchema);
module.exports = Box;
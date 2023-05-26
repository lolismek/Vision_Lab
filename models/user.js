const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    handle: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    },
    projects: {
        type: [{
            projectId: {
                type: String,
                required: true
            },
            projectName: {
                type: String,
                required: true
            }
        }]
    },
    sessions: {
        type: [String]
    }
}, {timestamps: true});

const User = mongoose.model('User', userSchema);
module.exports = User;
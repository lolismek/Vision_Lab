const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const User = require('./models/user');
const Project = require('./models/project');
const Plot = require('./models/plot');
const Model = require('./models/model');
const Box = require('./models/box');
const { render } = require('ejs');
const cookieParser = require('cookie-parser');
const { format } = require('morgan');
const url = require('url');
const FileReader = require('filereader');
const fileUpload = require("express-fileupload");
const { createHash } = require('crypto');
const GoogleChartsNode = require('google-charts-node');
const { platform } = require('os');
const googleCharts = require('google-charts');
const tf = require('@tensorflow/tfjs-node');
require('dotenv').config();

const tools = require('./mymiddleware');
const tfTools = require('./tf_middleware.js');

const app = express();

const dbURI = process.env.DB_LINK;
mongoose.set('strictQuery', true);
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then((result) => {
        console.log('connected to db');
        app.listen(3030);
    })
    .catch((err) => {
        console.log(err)
    });

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());

app.get('/', (req, res) => {
    let aux = tools.getWarning(req, res);
    let warn = aux.warn;
    let warningMessage = aux.warningMessage;

    tools.getHandle(req)
        .then((loginResult) => {
            let handle = loginResult.handle;
            let foundHandle = loginResult.foundHandle;
            Project.find({ visible: true })
                .sort({ createdAt: -1 })
                .then((results) => {
                    let projects = [];
                    let years = [];
                    let months = [];
                    let days = [];
                    let links = [];
                    let descs = [];
                    let cnt = 0;
                    for (let proj in results) {
                        ++cnt;
                        projects.push(results[proj].name);
                        years.push(results[proj].createdAt.getFullYear());
                        months.push(results[proj].createdAt.getMonth());
                        days.push(results[proj].createdAt.getDate());
                        links.push('/project/' + results[proj]._id);
                        descs.push(results[proj].desc);
                        if (cnt == 5) {
                            break;
                        }
                    }

                    let maxpage = Math.ceil(results.length / 5);
                    res.render('index.ejs', { _loggedIn: foundHandle, _handle: handle, _warn: warn, _warningMessage: warningMessage, projects: projects, years: years, months: months, days: days, links: links, descs: descs, pagenumber: 1, maxpage: maxpage });
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/getpage', (req, res) => {
    let pageid = req.body.pageid;

    let from = 5 * (pageid - 1) + 1;
    let to = 5 * pageid;

    let cnt = 0;
    Project.find({ visible: true })
        .sort({ createdAt: -1 })
        .then((results) => {
            let projects = [];
            let years = [];
            let months = [];
            let days = [];
            let links = [];
            let descs = [];
            for (let proj in results) {
                ++cnt;
                if (from <= cnt && cnt <= to) {
                    projects.push(results[proj].name);
                    years.push(results[proj].createdAt.getFullYear());
                    months.push(results[proj].createdAt.getMonth());
                    days.push(results[proj].createdAt.getDate());
                    links.push('/project/' + results[proj]._id);
                    descs.push(results[proj].desc);
                }

                if (from > to) {
                    break;
                }
            }

            res.status(200).send({projects: projects, years: years, months: months, days: days, links: links, descs: descs});
        })
        .catch((err) => {
            console.log(err);
            res.status(500).send(err);
        })
})

app.get('/signup', (req, res) => {
    tools.getHandle(req)
    .then((loginResult) => {
        let foundHandle = loginResult.foundHandle;

        if(foundHandle){
            res.cookie('warning', 'you have to logout to signup again', {maxAge: 1000});
            res.redirect('/');
            return;
        }

        let aux = tools.getWarning(req, res);
        let warn = aux.warn;
        let warningMessage = aux.warningMessage;
    
        res.render('signup.ejs', { _warn: warn, _warningMessage: warningMessage });
    })
    .catch((err) => {
        console.log(err);
    })
})

app.post('/signup', (req, res) => {
    const handle = req.body.handle;
    const pass1 = req.body.password1;
    const pass2 = req.body.password2;

    if (pass1 != pass2) {
        res.cookie('warning', "passwords don't match", { maxAge: 1000 });
        res.redirect('/signup');
        return;
    }

    User.find({ 'handle': handle })
        .then((result) => {
            if (result.length > 0) {
                res.cookie('warning', "handle is taken", { maxAge: 1000 });
                res.redirect('/signup');
                return;
            } else {
                const salt = tools.randomKey(32);
                let hashPassword = createHash('sha256').update(pass1 + salt).digest('hex');
                const user = new User({ handle: handle, password: hashPassword, salt: salt });
                const randomKey = tools.randomKey(32);
                user.sessions.push(randomKey);
                user.save()
                    .then((result) => {
                        res.cookie('handle', { handle: handle, key: randomKey }, { maxAge: 7200000 });
                        res.redirect('/');
                        return;
                    })
                    .catch((err) => {
                        console.log(err);
                    })
            }
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/login', (req, res) => {
    let aux = tools.getWarning(req, res);
    let warn = aux.warn;
    let warningMessage = aux.warningMessage;

    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;
            if(foundHandle){
                res.cookie('warning', 'you have to logout to login again', {maxAge: 1000});
                res.redirect('/');
                return;
            }
            res.render('login.ejs', { _warn: warn, _warningMessage: warningMessage });
        })
        .catch((err) => {
            console.log(err);
        })

})

app.post('/login', (req, res) => {
    const handle = req.body.handle;
    let pass = req.body.password;

    User.findOne({ 'handle': handle })
        .then((result) => {
            if (result) {
                const hashPass = createHash('sha256').update(pass + result.salt).digest('hex');
                if (hashPass != result.password) {
                    res.cookie('warning', 'wrong creditentials');
                    res.redirect('/login');
                    return;
                }

                const randomKey = tools.randomKey(32);
                result.sessions.push(randomKey);

                result.save()
                    .then(() => {
                        res.cookie('handle', { handle: handle, key: randomKey }, { maxAge: 7200000 });
                        res.redirect('/');
                        return;
                    })
                    .catch((err) => {
                        console.log(err);
                    })
            } else {
                res.cookie('warning', 'wrong creditentials');
                res.redirect('/login');
                return;
            }
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/logout', (req, res) => {
    for (let cookie in req.cookies) {
        if (cookie === 'handle') {
            res.clearCookie('handle');
            break;
        }
    }

    res.redirect('/');
    return;
})

app.get('/new', (req, res) => {
    let aux = tools.getWarning(req, res);
    let warn = aux.warn;
    let warningMessage = aux.warningMessage;

    console.log("hello-1");
    res.render('new.ejs', { _warn: warn, _warningMessage: warningMessage });
})

app.post('/new', fileUpload({ createParentPath: true, limits: { fileSize: 30720 } }), (req, res) => {
    //console.log(files['contests_sample.csv'].data.toString("utf8"));
    // utf-8 decoding when not specified!!!

    if (!req.files || Object.keys(req.files).length === 0) {
        //return res.status(400).send('No files were uploaded.');
        res.cookie('warning', 'no files were uploaded or the file exceded the size limit', { maxAge: 1000 });
        res.redirect('/new');
        return;
    }

    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            const sampleFile = req.files.sampleFile;

            let aux = tools.extractFromCSV(sampleFile);

            let datatypes = [];
            for (let i = 0; i < aux.collumns.length; i++) {
                if (isNaN(aux.mat[0][i])) {
                    datatypes.push("string");
                } else {
                    datatypes.push("number");
                    // for(let j = 1; j < aux.mat.length; j++){
                    //     if(isNaN(aux.mat[j][i])){

                    //     }
                    // }
                }
            }

            console.log("hello3");
            const project = new Project({ name: req.body.projectName, private: true, visible: (req.body.visible === 'on'), data: sampleFile.data, filename: sampleFile.name, collumns: aux.collumns, datatypes: datatypes, dataMatrix: aux.mat, editors: [handle], desc: req.body.desc });

            project.save()
                .then((result) => {
                    console.log("hello4");
                    User.findOne({ handle: handle })
                        .then((user) => {
                            console.log("hello5");
                            user.projects.push({ projectId: project._id, projectName: project.name });

                            user.save()
                                .then((result) => {
                                    console.log("hello6");
                                    res.redirect('/new');
                                    return;
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/profile', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            tools.extractUserProjects(handle, 1)
                .then((data) => {

                    // years.push(results[proj].createdAt.getFullYear());
                    // months.push(results[proj].createdAt.getMonth());
                    // days.push(results[proj].createdAt.getDate());

                    res.render('profile.ejs', { handle: handle, maxpage: data.maxpage, projects: data.projects, years: data.years, months: data.months, days: data.days, links: data.links, descs: data.descs, pagenumber: 1, day: loginResult.day, month: loginResult.month, year: loginResult.year });
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/project/:id', (req, res) => {
    // tools.getHandle(req)
    // .then((loginResult) => {
    //     let foundHandle = loginResult.foundHandle;
    //     let handle = loginResult.handle;

    //     if(!foundHandle){
    //         res.cookie('warning', 'you are not logged in', {maxAge: 1000});
    //         res.redirect('/');
    //         return;
    //     }

    //     let aux;
    // })
    // .catch((err) => {
    //     console.log(err);
    // })

    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            // if(!foundHandle){
            //     res.cookie('warning', 'you are not logged in', {maxAge: 1000});
            //     res.redirect('/');
            //     return;
            // }

            let aux;

            const id = req.params.id;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }

                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && !project.visible) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let filelink = '/project/fileview/' + id;
                    let changelink = '/project/filechange/' + id;

                    let plotlinks = [];
                    let plotsNames = project.plotsNames;
                    for (let element in project.plotsIds) {
                        plotlinks.push('/project/' + id + '/plot/' + project.plotsIds[element]);
                    }
                    let newplotlink = '/project/newplot/' + id;

                    let modellinks = [];
                    let modelNames = project.modelNames;
                    for (let element in project.modelIds) {
                        modellinks.push('/project/' + id + '/model/' + project.modelIds[element]);
                    }
                    let newmodellink = '/project/newmodel/' + id;

                    let newEditorLink = '/project/neweditor/' + id;

                    let deleteLink = '/project/delete/' + id;

                    let editors = [];
                    for (let ed in project.editors) {
                        editors.push(project.editors[ed]);
                    }

                    tools.extractBoxes(id, 'main')
                        .then((result) => {
                            let boxIds = result.boxIds;
                            let boxContents = result.boxContents;
                            res.render('project.ejs', { name: project.name, filename: project.filename, filelink: filelink, changelink: changelink, collumns: project.collumns, plotlinks: plotlinks, newplotlink: newplotlink, modellinks: modellinks, newmodellink: newmodellink, boxIds: boxIds, boxContents: boxContents, projectId: id, editors: editors, newEditorLink: newEditorLink, deleteLink: deleteLink, isEditor: isEditor, _loggedIn: foundHandle, plotsNames: plotsNames, modelNames: modelNames });
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    res.redirect('/404');
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/project/getpage', (req, res) => {
    let pageid = req.body.pageid;

    console.log(pageid);

    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if(!foundHandle){
                res.cookie('warning', 'you are not logged in', {maxAge: 1000});
                res.redirect('/');
                return;
            }

            tools.extractUserProjects(handle, pageid)
                .then((data) => {
                    res.status(200).send(data);
                    return;
                })
                .catch((err) => {
                    console.log(err);
                    res.status(500).send(err);
                })
        })
        .catch((err) => {
            console.log(err);
            res.status(500).send(err);
        })
})

app.post('/createbox/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;

            const id = req.params.id;
            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }

                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private == true) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    const box = new Box({ projectId: { id: id, branch: req.body.branch }, content: '' });
                    box.save()
                        .then(() => {
                            project.boxIds.push(box._id);
                            project.save()
                                .then(() => {
                                    console.log(box._id);
                                    res.send(box._id);
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/savebox/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;

            const id = req.params.id;
            const boxId = req.body.boxId;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private == true) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundBox = false;
                    for (let ell in project.boxIds) {
                        if (project.boxIds[ell] === boxId) {
                            foundBox = true;
                        }
                    }

                    if (!foundBox) {
                        res.status(500).send('Box does not exist in this project');
                        return;
                    }

                    Box.findById(boxId)
                        .then((box) => {
                            box.content = req.body.boxContent;
                            box.save()
                                .then(() => {
                                    res.status(200).send();
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/deletebox/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;

            const id = req.params.id;
            const boxId = req.body.boxId;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private == true) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundBox = false;
                    let pos = 0;
                    for (let ell in project.boxIds) {
                        if (project.boxIds[ell] === boxId) {
                            foundBox = true;
                            pos = ell;
                        }
                    }

                    if (!foundBox) {
                        res.status(500).send('Box does not exist in this project');
                        return;
                    }

                    console.log(project.boxIds);
                    project.boxIds.splice(pos, 1);
                    console.log(project.boxIds);
                    project.save()
                        .then(() => {
                            Box.deleteOne({ _id: boxId })
                                .then(() => {
                                    res.status(200).send();
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/boxup/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;

            const id = req.params.id;
            const boxId = req.body.boxId;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private == true) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundBox = false;
                    let pos = 0;
                    for (let ell in project.boxIds) {
                        if (project.boxIds[ell] === boxId) {
                            foundBox = true;
                            pos = ell;
                        }
                    }
                    pos = Number(pos);

                    tools.findPrevBox(id, pos)
                        .then((pos2) => {
                            if (pos2 == -1) {
                                res.status(500).send('Box does not exist in this project');
                                return;
                            }

                            let hm = project.boxIds[pos];
                            project.boxIds[pos] = project.boxIds[pos2];
                            project.boxIds[pos2] = hm;

                            project.save()
                                .then(() => {
                                    res.status(200).send();
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
});

app.post('/boxdown/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            const id = req.params.id;
            const boxId = req.body.boxId;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private == true) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundBox = false;
                    let pos = 0;
                    for (let ell in project.boxIds) {
                        if (project.boxIds[ell] === boxId) {
                            foundBox = true;
                            pos = ell;
                        }
                    }
                    pos = Number(pos);

                    tools.findNextBox(id, pos)
                        .then((pos2) => {
                            if (pos2 == -1) {
                                res.status(500).send('Box does not exist in this project');
                                return;
                            }

                            let hm = project.boxIds[pos];
                            project.boxIds[pos] = project.boxIds[pos2];
                            project.boxIds[pos2] = hm;

                            project.save()
                                .then(() => {
                                    res.status(200).send();
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/project/fileview/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            let aux;
            const id = req.params.id;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    project.editors.forEach((element) => {
                        if (element === handle) {
                            isEditor = true;
                        }
                    })

                    if (!isEditor && project.private) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let file = project.data.toString("utf8");
                    let filearray = file.split('\n');

                    res.render('fileview.ejs', { filearray: filearray });
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })

})

app.get('/project/filechange/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            const id = req.params.id;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = true;
                    project.editors.forEach((element) => {
                        if (element === handle) {
                            isEditor = true;
                        }
                    })

                    if (!isEditor && project.private) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    const link = '/project/filechange/' + id;
                    res.render('filechange.ejs', { _warn: false, _warningMessage: '', link: link });
                })
                .catch((err) => {
                    console.log(err)
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/project/filechange/:id', fileUpload({ createParentPath: true, limits: { fileSize: 30720 } }), (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            const sampleFile = req.files.sampleFile;

            let aux;

            const id = req.params.id;
            const projectLink = '/project/' + id;
            if (!req.files || Object.keys(req.files).length === 0) {
                //return res.status(400).send('No files were uploaded.');
                res.cookie('warning', 'no files were uploaded', { maxAge: 1000 });
                res.redirect(projectLink);
                return;
            }

            aux = tools.extractFromCSV(sampleFile);

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    project.data = sampleFile.data;
                    project.filename = sampleFile.name;
                    project.collumns = aux.collumns;
                    project.dataMatrix = aux.mat;

                    project.datatypes = [];
                    for (let i = 0; i < aux.collumns.length; i++) {
                        if (isNaN(aux.mat[0][i])) {
                            project.datatypes.push("string");
                        } else {
                            project.datatypes.push("number");
                        }
                    }

                    project.plotsIds = [];
                    project.modelIds = [];

                    project.save()
                        .then((result) => {
                            res.redirect(projectLink);
                            return;
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })

})

app.get('/project/newplot/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            let aux;
            aux = tools.getWarning(req, res);
            let warn = aux.warn;
            let warningMessage = aux.warningMessage;

            const id = req.params.id;
            postlink = '/project/newplot/' + id;
            console.log(postlink);

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;

                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private == true) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let options = [];
                    for(let ind in project.collumns){
                        if(project.datatypes[ind] === 'number'){
                            options.push(project.collumns[ind]);
                        }
                    }

                    res.render('newplot.ejs', { _warn: warn, _warningMessage: warningMessage, postlink: postlink, options: options });
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/project/newplot/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            let plotTitle = req.body.title;
            let xAxisName = req.body.xAxisName;
            let yAxisName = req.body.yAxisName;
            let connect = (req.body.connect === "on");

            const id = req.params.id;

            let foundX = false, foundY = false;
            let notnumbers = false;
            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let element in project.editors) {
                        if (project.editors[element] === handle) {
                            isEditor = true;
                        }
                    }
                    if (!isEditor && project.private) {
                        res.cookie('warning', 'you are not an editor', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let i = 0;
                    for (let collumn in project.collumns) {
                        if (project.collumns[collumn] === xAxisName) {
                            foundX = true;
                            if (project.datatypes[i] !== "number") {
                                notnumbers = true;
                            }
                        }
                        if (project.collumns[collumn] === yAxisName) {
                            foundY = true;
                            if (project.datatypes[i] !== "number") {
                                notnumbers = true;
                            }
                        }
                        i++;
                    }

                    let redirectlink = '/project/newplot/' + id;
                    if (!foundX || !foundY) {
                        res.cookie('warning', 'some collumns do not exist', { maxAge: 1000 });
                        res.redirect(redirectlink);
                        return;
                    }
                    if (notnumbers) {
                        res.cookie('warning', 'some data might not be numbers', { maxAge: 1000 });
                        res.redirect(redirectlink);
                        return;
                    }

                    let link = '/project/' + id;
                    res.redirect(link);
                    //return;

                    const plot = new Plot({ projectId: id, name: plotTitle, xAxisName: xAxisName, yAxisName: yAxisName, connect: connect });

                    plot.save()
                        .then((result) => {
                            Project.findById(id)
                                .then((project) => {
                                    project.plotsIds.push(plot._id);
                                    project.plotsNames.push(plot.name);

                                    project.save()
                                        .then((result) => {
                                            // let link = '/project/' + id;
                                            // res.redirect(link);
                                            // //return;

                                            let mat = tools.getMat(project, plot);

                                            tools.getImage(mat, plot.name, plot.xAxisName, plot.yAxisName, plot.connect)
                                                .then((img) => {
                                                    let encode = 'data:image/png;base64,' + img.toString('base64');
                                                    plot.image = encode;

                                                    plot.save()
                                                        .then((result) => {
                                                        })
                                                        .catch((err) => {
                                                            console.log(err);
                                                        })
                                                })
                                                .catch((err) => {
                                                    console.log(err);
                                                })
                                        })
                                        .catch((err) => {
                                            console.log(err);
                                        })
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/project/:id/plot/:id2', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            // if (!foundHandle) {
            //     res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
            //     res.redirect('/');
            //     return;
            // }

            let aux;
            const id = req.params.id;
            const id2 = req.params.id2;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;

                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && !project.visible) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundId = false;
                    for (let el in project.plotsIds) {
                        if (project.plotsIds[el] === id2) {
                            foundId = true;
                        }
                    }

                    if (!foundId) {
                        res.cookie('warning', 'this plot is not part of the project')
                        res.redirect('/');
                        return;
                    }

                    Plot.findById(id2)
                        .then((plot) => {
                            if (!plot) {
                                res.redirect('/404');
                                return;
                            }
                            if (plot.projectId != id) {
                                res.cookie('warning', 'this plot is not in the selected project');
                                res.redirect('/');
                                return;
                            }

                            let mat = tools.getMat(project, plot);
                            let toobig = (project.dataMatrix.length > 20000);

                            let hm = 'plot/' + id2;
                            tools.extractBoxes(id, hm)
                                .then((result) => {
                                    let boxIds = result.boxIds;
                                    let boxContents = result.boxContents;
                                    let deleteLink = '/project/' + id + '/plot/delete/' + id2;
                                    res.render('plot.ejs', { mat: mat, title: plot.name, desc: plot.description, connect: plot.connect, img: plot.image, toobig: toobig, plotId: id2, projectId: id, boxIds: boxIds, boxContents, deleteLink: deleteLink, isEditor: isEditor, _loggedIn: foundHandle, xAxisName: plot.xAxisName, yAxisName: plot.yAxisName });
                                })
                                .catch((err) => {
                                    console.log(err);
                                })

                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    res.redirect('/404');
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/project/newmodel/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            let aux;
            aux = tools.getWarning(req, res);
            let warn = aux.warn;
            let warningMessage = aux.warningMessage;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            const id = req.params.id;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private) {
                        res.cookie('warning', 'you are not an editor', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let options = [];
                    for (let collumn in project.collumns) {
                        if (project.datatypes[collumn] === 'number') {
                            options.push(project.collumns[collumn]);
                        }
                    }

                    let link = '/project/newmodel/' + id;
                    res.render('newmodel.ejs', { options: options, _warn: warn, _warningMessage: warningMessage, link: link });
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/project/newmodel/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            const name = req.body.name;
            let X = req.body.xparameters;
            const Y = req.body.yparameters;

            if (typeof X !== 'object') {
                X = [X];
            }

            const id = req.params.id;

            for (let element in X) {
                if (X[element] === Y) {
                    res.cookie('warning', 'the y parameter coincides with one of the x parameters', { maxAge: 1000 });
                    res.redirect('/project/newmodel/' + id);
                    return;
                }
            }

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private) {
                        res.cookie('warning', 'you are not an editor', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    const learningRate = Number(req.body.learningRate);
                    let epochs = Number(req.body.epochs);

                    if (isNaN(learningRate) || isNaN(epochs)) {
                        res.cookie('warning', 'epochs and learning rate should be numbers');
                        return res.redirect('/project/newmodel/' + id);

                    }

                    if (Number(learningRate) > 1 || Number(learningRate) < 0) {
                        res.cookie('warning', 'learnig rate should be between 0 and 1');
                        res.redirect('/project/newmodel/' + id);
                        return;
                    }

                    res.redirect('/project/' + id);

                    epochs = Math.min(epochs, 500);

                    aux = tools.getTrainingData(project, X, Y);
                    const xdata = aux.xdata;
                    const ydata = aux.ydata;

                    tfTools.trainModel(xdata, ydata, learningRate, epochs)
                        .then((result) => {
                            const model = new Model({ name: name, modelBuffer: result.buff, xcol: X, ycol: Y, minX: result.minX, maxX: result.maxX, minY: result.minY, maxY: result.maxY, projectId: id });
                            model.save()
                                .then((result2) => {
                                    project.modelIds.push(model._id);
                                    project.modelNames.push(model.name);
                                    project.save()
                                        .then((result3) => {
                                            console.log("hurray");
                                        })
                                        .catch((err) => {
                                            console.log(err);
                                        })
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/project/:id/model/:id2', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            // if (!foundHandle) {
            //     res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
            //     res.redirect('/');
            //     return;
            // }

            let aux;
            const id = req.params.id;
            const id2 = req.params.id2;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && !project.visible) {
                        res.cookie('warning', 'you are not an editor', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundId = false;
                    for (let el in project.modelIds) {
                        if (project.modelIds[el] === id2) {
                            foundId = true;
                        }
                    }

                    if (!foundId) {
                        res.cookie('warning', 'this model is not part of the project')
                        res.redirect('/');
                        return;
                    }

                    Model.findById(id2)
                        .then((model) => {
                            if (!model) {
                                res.redirect('/404');
                                return;
                            }

                            if (model.projectId != id) {
                                res.cookie('warning', 'this model is not in the selected project');
                                res.redirect('/');
                                return;
                            }
                            const link = '/project/' + id + '/model/predict/' + id2;
                            let hm = 'model/' + id2;

                            tools.extractBoxes(id, hm)
                                .then((result) => {
                                    let boxIds = result.boxIds;
                                    let boxContents = result.boxContents;
                                    let deleteLink = '/project/' + id + '/model/delete/' + id2;
                                    res.render('model.ejs', { link: link, log: model.log, xcol: model.xcol, projectId: id, modelId: id2, boxIds: boxIds, boxContents: boxContents, deleteLink: deleteLink, isEditor: isEditor, _loggedIn: foundHandle, title: model.name, ycol: model.ycol });
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    res.redirect('/404');
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/project/:id/model/predict/:id2', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            aux = tools.getWarning(req, res);
            let warn = aux.warn;
            let warningMessage = aux.warningMessage;

            const id = req.params.id;
            const id2 = req.params.id2;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }

                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private) {
                        res.cookie('warning', 'you are not an editor', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundId = false;
                    for (let el in project.modelIds) {
                        if (project.modelIds[el] === id2) {
                            foundId = true;
                        }
                    }

                    if (!foundId) {
                        res.cookie('warning', 'this plot is not part of the project')
                        res.redirect('/');
                        return;
                    }

                    Model.findById(id2)
                        .then((result) => {
                            if (!result) {
                                res.redirect('/404');
                                return;
                            }
                            if (result.projectId != id) {
                                res.cookie('warning', 'this model is not in the selected project');
                                res.redirect('/');
                                return;
                            }
                            const postLink = '/project/' + id + '/model/predict/' + id2;
                            res.render('modelpredict.ejs', { _warn: warn, _warningMessage: warningMessage, xcol: result.xcol, postLink: postLink });
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/project/:id/model/predict/:id2', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            const id = req.params.id;
            const id2 = req.params.id2;

            Project.findById(id)
                .then((project) => {
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private) {
                        res.cookie('warning', 'you are not an editor', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundId = false;
                    for (let el in project.modelIds) {
                        if (project.modelIds[el] === id2) {
                            foundId = true;
                        }
                    }

                    let X = [];
                    for (let collumn in req.body) {
                        if (isNaN(req.body[collumn])) {
                            res.cookie('warning', 'you have entered non number data', { maxAge: 1000 });
                            res.redirect('/project/' + id + '/model/' + id2);
                            return;
                        }
                        X.push(Number(req.body[collumn]));
                    }

                    Model.findById(id2)
                        .then((result) => {
                            tfTools.getPredict(result.modelBuffer, result.minX, result.maxX, result.minY, result.maxY, X)
                                .then((pred) => {
                                    console.log(X);
                                    result.log.push({ x: X, y: pred });

                                    result.save()
                                        .then(() => {
                                            console.log("hurray");
                                        })
                                        .catch((err) => {
                                            console.log(err);
                                        })
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                            res.redirect('/project/' + id + '/model/' + id2);
                            return;
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/project/neweditor/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            const id = req.params.id;
            const newEditor = req.body.newUser;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private) {
                        res.cookie('warning', 'you are not an editor', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    // add the new editor or give according warnings
                    let exists = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === newEditor) {
                            exists = true;
                        }
                    }

                    if (exists) {
                        res.status(200).send("The user is alredy an editor!");
                        return;
                    }

                    User.findOne({ handle: newEditor })
                        .then((user) => {
                            if (user) {
                                user.projects.push({ projectId: id, projectName: project.name });
                                user.save()
                                    .then(() => {
                                        project.editors.push(newEditor);
                                        project.save()
                                            .then(() => {
                                                res.status(200).send("ok");
                                            })
                                            .catch((err) => {
                                                console.log(err);
                                            })
                                    })
                                    .catch((err) => {
                                        console.log(err);
                                    })
                            } else {
                                res.status(200).send('User might not exist!');
                                return;
                            }
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/project/delete/:id', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            const id = req.params.id;

            Project.findById(id)
                .then((project) => {
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private == true) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    // delete this project
                    Project.findByIdAndDelete(id)
                        .then(() => {
                            User.findOne({ handle: handle })
                                .then((user) => {
                                    for (let ind in user.projects) {
                                        if (user.projects[ind].projectId === id) {
                                            user.projects.splice(ind, 1);
                                            break;
                                        }
                                    }
                                    user.save()
                                        .then(() => {
                                            res.redirect('/');
                                        })
                                        .catch((err) => {
                                            console.log(err);
                                        })
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/project/:id/plot/delete/:id2/', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            const id = req.params.id;
            const id2 = req.params.id2;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }

                    let isEditor = false;

                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private == true) {
                        res.cookie('warning', 'you are not an editor and this project is private or you have been logged out', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundId = false;
                    for (let el in project.plotsIds) {
                        if (project.plotsIds[el] === id2) {
                            foundId = true;
                        }
                    }

                    if (!foundId) {
                        res.cookie('warning', 'this plot is not part of the project')
                        res.redirect('/');
                        return;
                    }

                    Plot.findById(id2)
                        .then((plot) => {
                            if (!plot) {
                                res.redirect('/404');
                                return;
                            }

                            if (plot.projectId != id) {
                                res.cookie('warning', 'this plot is not in the selected project');
                                res.redirect('/');
                                return;
                            }

                            Plot.findByIdAndDelete(id2)
                                .then(() => {
                                    Project.findOne({ _id: id })
                                        .then((project) => {
                                            for (let ind in project.plotsIds) {
                                                if(project.plotsIds[ind] === id2){
                                                    project.plotsIds.splice(ind, 1);
                                                    project.plotsNames.splice(ind, 1);
                                                    break;
                                                }
                                            }
                                            project.save()
                                                .then(() => {
                                                    res.redirect('/project/' + id);
                                                })
                                                .catch((err) => {
                                                    console.log(err);
                                                })
                                        })
                                        .catch((err) => {
                                            console.log(err);
                                        })
                                })
                                .catch((er) => {
                                    console.log(err);
                                })

                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.post('/project/:id/model/delete/:id2', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let foundHandle = loginResult.foundHandle;
            let handle = loginResult.handle;

            if (!foundHandle) {
                res.cookie('warning', 'you are not logged in', { maxAge: 1000 });
                res.redirect('/');
                return;
            }

            let aux;
            const id = req.params.id;
            const id2 = req.params.id2;

            Project.findById(id)
                .then((project) => {
                    if (!project) {
                        res.redirect('/404');
                        return;
                    }
                    let isEditor = false;
                    for (let editor in project.editors) {
                        if (project.editors[editor] === handle) {
                            isEditor = true;
                        }
                    }

                    if (!isEditor && project.private) {
                        res.cookie('warning', 'you are not an editor', { maxAge: 1000 });
                        res.redirect('/');
                        return;
                    }

                    let foundId = false;
                    for (let el in project.modelIds) {
                        if (project.modelIds[el] === id2) {
                            foundId = true;
                        }
                    }

                    if (!foundId) {
                        res.cookie('warning', 'this model is not part of the project')
                        res.redirect('/');
                        return;
                    }

                    Model.findByIdAndDelete(id2)
                        .then(() => {
                            Project.findOne({ _id: id })
                                .then((project) => {
                                    for (let ind in project.modelIds) {
                                        if(project.modelIds[ind] === id2){
                                            project.modelIds.splice(ind, 1);
                                            project.modelNames.splice(ind, 1);
                                        }
                                        break;
                                    }

                                    project.save()
                                        .then(() => {
                                            res.redirect('/project/' + id);
                                        })
                                        .catch((err) => {
                                            console.log(err);
                                        })
                                })
                                .catch((err) => {
                                    console.log(err);
                                })
                        })
                        .catch((err) => {
                            console.log(err);
                        })
                })
                .catch((err) => {
                    console.log(err);
                })
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/about', (req, res) => {
    tools.getHandle(req)
        .then((loginResult) => {
            let handle = loginResult.handle;
            let foundHandle = loginResult.foundHandle;
            res.render('about.ejs', {handle: handle, _loggedIn: foundHandle});
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get('/example', (req, res) => {
    res.render('example');
})

app.use((req, res) => {
    res.status(404).render('404');
})






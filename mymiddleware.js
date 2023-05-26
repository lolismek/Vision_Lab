const GoogleChartsNode = require('google-charts-node');
const tf = require('@tensorflow/tfjs-node');
const Box = require('./models/box');
const Project = require('./models/project');
const User = require('./models/user');

module.exports = {
    randomKey: function randomKey(len) {
        const randomString = [...Array(len)].map(i => (~~(Math.random() * 36)).toString(36)).join('');
        return randomString;
    },
    getHandle: async function getHandle(req) {
        let foundHandle = false;
        let handle = "";
        let key = "";
        for (let cookie in req.cookies) {
            if (cookie === 'handle') {
                foundHandle = true;
                handle = req.cookies[cookie].handle;
                key = req.cookies[cookie].key;
                break;
            }
        }

        if (!foundHandle) {
            return { foundHandle: foundHandle, handle: handle }
        }

        const user = await User.findOne({ handle: handle });
        let foundKey = false;
        for (let ind in user.sessions) {
            if (user.sessions[ind] === key) {
                foundKey = true;
                break;
            }
        }

        if (!foundKey) {
            foundHandle = false;
            handle = "";
        }

        let day = user.createdAt.getDate();
        let month = user.createdAt.getMonth();
        let year = user.createdAt.getFullYear();

        return { handle: handle, foundHandle: foundHandle, day: day, month: month, year: year };
    },
    getWarning(req, res) {
        let warn = false;
        let warningMessage;

        for (let cookie in req.cookies) {
            if (cookie === 'warning') {
                warn = true;
                warningMessage = req.cookies[cookie];
                res.clearCookie('warning');
                break;
            }
        }

        return { warn: warn, warningMessage: warningMessage };
    },
    extractFromCSV(sampleFile) {
        let sampleFileString = sampleFile.data.toString("utf-8");
        sampleFileString = sampleFileString.replaceAll('\r', '');
        sampleFileString = sampleFileString.replaceAll(';', ',');
        console.log(sampleFileString);
        let filearray = sampleFileString.split('\n');
        // for (let i = 0; i < filearray.length; i++) {
        //     filearray[i] = filearray[i].replace('\r', ''); 
        //     filearray[i] = filearray[i].replace(';', ',');
        // }

        let collumns = filearray[0];
        collumns = collumns.split(',');

        let mat = [];
        for (let i = 1; i < filearray.length; i++) {
            let arr = filearray[i].split(',');
            mat.push(arr);
        }

        return { collumns: collumns, mat: mat };
    },
    getMat(project, plot) {
        let nRows = project.dataMatrix.length + 1;
        let mat = new Array(nRows);
        for (let i = 0; i < nRows; i++) {
            mat[i] = new Array(2);
        }

        mat[0][0] = plot.xAxisName;
        mat[0][1] = plot.yAxisName;

        let ind1 = 0, ind2 = 0;
        for (let i = 0; i < project.collumns.length; i++) {
            if (project.collumns[i] === plot.xAxisName) {
                ind1 = i;
            }
            if (project.collumns[i] === plot.yAxisName) {
                ind2 = i;
            }
        }

        let arr = [];

        for (let i = 1; i < nRows; i++) {
            arr.push({ first: project.dataMatrix[i - 1][ind1], second: project.dataMatrix[i - 1][ind2] });
            arr[arr.length - 1].first = Number(arr[arr.length - 1].first);
            arr[arr.length - 1].second = Number(arr[arr.length - 1].second);
        }

        arr.sort(function (obj1, obj2) {
            return obj1.first - obj2.first;
        });

        for (let i = 1; i < nRows; i++) {
            mat[i][0] = arr[i - 1].first;
            mat[i][1] = arr[i - 1].second;
        }

        return mat;
    },
    getImage: async function getImage(mat, plotTitle, xAxisName, yAxisName, connect) {
        let codeString;

        if (connect) {
            codeString = `const data = google.visualization.arrayToDataTable(${JSON.stringify(mat)});                  const options = {            title: '${plotTitle}',            legend: {position: 'bottom'},	            curveType: 'function'          };                  const chart = new google.visualization.LineChart(container); chart.draw(data, options);`;
        } else {
            codeString = `const data = google.visualization.arrayToDataTable(${JSON.stringify(mat)});                  const options = {            title: '${plotTitle}',            legend: {position: 'bottom'},	            pointsize: 3          };                  const chart = new google.visualization.ScatterChart(container); chart.draw(data, options);`;
        }

        const image = await GoogleChartsNode.render(codeString);
        return image;
    },
    getTrainingData(project, X, Y) {
        let xset = new Set(X);
        let xdata = [], ydata = [];

        for (let arr in project.dataMatrix) {
            let aux = [];
            for (let collumn in project.collumns) {
                if (xset.has(project.collumns[collumn])) {
                    aux.push(Number(project.dataMatrix[arr][collumn]));
                } else if (project.collumns[collumn] === Y) {
                    ydata.push(Number(project.dataMatrix[arr][collumn]));
                }
            }
            xdata.push(aux);
        }

        return { xdata: xdata, ydata: ydata };
    },
    extractBoxes: async function extractBoxes(id, branch) {
        let boxIds = [];
        let boxContents = [];

        const project = await Project.findById(id);
        for (let box in project.boxIds) {
            const result = await Box.findById(project.boxIds[box]);
            if (result !== null && result.projectId.branch === branch) {
                boxIds.push(project.boxIds[box]);
                boxContents.push(result.content);
            }
        }

        return { boxIds: boxIds, boxContents: boxContents };
    },
    findPrevBox: async function findPrevBox(id, pos) {
        const project = await Project.findById(id);
        const box = await Box.findById(project.boxIds[pos]);
        const branch = box.projectId.branch;

        for (let pos2 = pos - 1; pos2 >= 0; pos2--) {
            const altBox = await Box.findById(project.boxIds[pos2]);
            const altBranch = altBox.projectId.branch;

            if (branch === altBranch) {
                return pos2;
            }
        }

        return -1;
    },
    findNextBox: async function findNextBox(id, pos) {
        const project = await Project.findById(id);
        const box = await Box.findById(project.boxIds[pos]);
        const branch = box.projectId.branch;

        for (let pos2 = pos + 1; pos2 < project.boxIds.length; pos2++) {
            const altBox = await Box.findById(project.boxIds[pos2]);
            const altBranch = altBox.projectId.branch;

            if (branch === altBranch) {
                return pos2;
            }
        }

        return -1;
    },
    extractUserProjects: async function extractUserProjects(handle, pagenumber){
        let user = await User.findOne({handle: handle})
        let projects = [];
        let years = [];
        let months = [];
        let days = [];
        let links = [];
        let descs = [];

        let cnt = 0;
        let from = 5 * (pagenumber - 1) + 1;
        let to = 5 * pagenumber;

        user.projects.reverse();

        if(user.projects.length > 0){
            for(let ind in user.projects){
                ++cnt;

                if(from <= cnt && cnt <= to){
                    let project = await Project.findOne({_id: user.projects[ind].projectId});
                    projects.push(project.name);
                    years.push(project.createdAt.getFullYear());
                    months.push(project.createdAt.getMonth());
                    days.push(project.createdAt.getDate());
                    links.push('/project/' + project._id);
                    descs.push(project.desc);
                }
            }
        }

        let maxpage = Math.ceil(user.projects.length / 5);
        return {maxpage: maxpage, projects: projects, years: years, months: months, days: days, links: links, descs: descs};
    }
}
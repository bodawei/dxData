/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Copyright (c) 2013, 2014 by Delphix. All rights reserved.
 */

/*global basePath, testType, fs, files, exclude, preprocessors */

var fs = require("fs");
var basePath = process.cwd();
var testType="unit";


files = [
    "node_modules/jquery/dist/jquery.js",
    "node_modules/underscore/underscore.js",
    "node_modules/backbone/backbone.js",
    "dxCoreData/test/jasmineSetup.js",
    "dxCoreData/dxBasics.js",
    "dxCoreData/layer1/**/*.js",
    "dxCoreData/layer2/**/*.js",
    "dxCoreData/layer3/**/*.js",
    "dxCoreData/test/delphixSchema.js",
    "dxCoreData/test/bootstrap-dxcoredata.js",
    "dxCoreData/mockServer/**/*.js",
    "dxCoreData/test/bootstrap-mock.js",
];

preprocessors = {};

// list of files to exclude
exclude = [
];

/*
 * Report configuration settings to the karma system.  For details, see
 * http://karma-runner.github.io/0.10/config/configuration-file.html
 */
module.exports = function(config) {
    config.set({
        basePath : basePath,
        frameworks: ["jasmine"],
        files: files,
        exclude: exclude,
        preprocessors: preprocessors,
        reporters: ['progress', 'junit'], // test results reporter to use. possible values: 'dots', 'progress', 'junit'
        junitReporter: {
            outputFile: basePath + "/out/" + testType + 'TestResults.xml'
        },
        coverageReporter: {
            type : 'html',
            dir : basePath + "/out/" + testType + 'TestCoverage/'
        },
        port: 9876,                 // web server port
        colors: true,               // enable / disable colors in the output (reporters and logs)
        logLevel: config.LOG_ERROR, // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
        autoWatch: false,           // enable / disable watching file and executing tests whenever any file changes
        browsers: ['PhantomJS'],
        captureTimeout: 20000,      // If browser does not capture in given timeout [ms], kill it
        // https://github.com/karma-runner/karma-ie-launcher/issues/8
        browserDisconnectTimeout: 10000,
        browserDisconnectTolerance: 2,
        browserNoActivityTimeout: 10000,
        singleRun: true,             // if true, it capture browsers, run tests and exit
    });
};


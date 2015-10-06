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
 * Copyright (c) 2014 by Delphix. All rights reserved.
 */

/*global module*/

'use strict'

module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        karma: {
            unit: {
                configFile: 'testSetup/karmaConfig.js'
            }
        },
        browserify: {
            options: {
                alias: {
                    dxLog: './src/module/dxLog.js',
                    dxData: './src/module/dxData.js'
                },
                browserifyOptions: {
                    debug: true
                },
                external: ["underscore"]
            },
            'dist-lib': {
                files: {
                    'dist/dxData.js': ['src/dxBasics.js', 'src/layer*/js/*.js']
                }
            },
            'dist-mockServer': {
                files: {
                    'dist/dxDataMockServer.js': ['src/mockServer/*.js']
                }
            },
            'dist-types': {
                files: {
                    'dist/dxDataTypes.js': ['src/modules/dxData.js']
                }
            }
        },
        extract_sourcemap: {
            options: { 'removeSourcesContent': true },
            'dist-lib': {
                files: {
                    'dist': ['dist/dxData.js']
                }
            },
            'dist-mockServer': {
                files: {
                    'dist/': ['dist/dxDataMockServer.js']
                }
            },
            'dist-types': {
                files: {
                    'dist/': ['dist/dxDataTypes.js']
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-extract-sourcemap');

    grunt.registerTask('default', [
        'browserify:dist-lib',
        'extract_sourcemap:dist-lib',
        'browserify:dist-mockServer',
        'extract_sourcemap:dist-mockServer',
        'browserify:dist-types',
        'extract_sourcemap:dist-types',
        'karma'
    ]);
}

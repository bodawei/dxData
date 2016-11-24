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
        schemaFiles: ['../schema/*.json', 'schema/*.json'],
        /*
         * Concatenate individual json-schema files into a combined JavaScript file
         */
        concat: {
            options: {
                banner: 'ALL_SCHEMAS = {\n',
                separator: ',\n',
                footer: '};',
                stripBanners: true,
                process: function(src, filepath) {
                    var nameStart = filepath.lastIndexOf('/');
                    return '"/' + filepath.substr(nameStart+1) + '": ' + src;
                }
            },
            default: {
                src: ['<%= schemaFiles %>'],
                dest: 'gen/allSchemas.js'
            }
        },
        
        /*
         * Copy the dxData distributions from the main distribution into this demo directory
         */
        copy: {
            'dist-lib': {
                expand: true,
                cwd: '../dist/',
                src: '*',
                dest: 'gen/',
            },
            'debug': {
                expand: true,
                cwd: '../',
                src: 'src/**',
                dest: 'gen/',
            }
        },
        
        shell: {
            /*
             * Produce python versions of the schema types
             */
            pythonSchemas: {
                command: function() {
                    return 'python python/parseSchemas.py python/schemaTypes'
                }
            },
            /*
             * Start up the web server for the demo app
             */
            runWebServer: {
                command: 'python python/server.py'
            }
        },

        /*
         * Clean up stuff we've built
         */
        clean: {
            default: {
               src: ['gen', '**/*.pyc', 'python/schemaTypes/*.py', '!python/schemaTypes/*Operations.py' ]
            }
         }
        
    });
    
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    
    grunt.registerTask('default', ['clean', 'concat', 'shell:pythonSchemas', 'copy:dist-lib', 'copy:debug']);
    grunt.registerTask('server', ['shell:runWebServer']);
}

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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*eslint-env jasmine */
/*global $ */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');

var AbstractServer = require('../../AbstractServer.js');
var CORE_SCHEMAS = require('../shared/coreSchemas.js');

describe('AbstractServer', function() {
    var jQueryAjax;

    beforeEach(function() {
        jQueryAjax = $.ajax;
    });

    afterEach(function() {
        if ($.ajax !== jQueryAjax) {
            $.ajax = jQueryAjax;
            dxLog.fail('$.ajax was not cleaned up.');
        }
    });

    describe('construction', function() {

        it('throw`s an error if not called with new', function() {
            expect(function() {
                AbstractServer(CORE_SCHEMAS);
            }).toDxFail('Must call AbstractServer() with new.');
        });

        it('throws an error if not called with schemas', function() {
            expect(function() {
                new AbstractServer();
            }).toDxFail('Must pass a map of schemas when constructing a server.');
        });

        it('throws an error if schemas do not include a Notification type', function() {
            expect(function() {
                new AbstractServer({
                    '/foo.json': {
                        name: 'SimpleType'
                    }
                });
            }).toDxFail('Schemas do not include a Notification type.');
        });

        it('constructs something with the primary AbstractServer functions', function() {
            var server = new AbstractServer(CORE_SCHEMAS);

            expect(server.start).toBeDefined();
            expect(server.stop).toBeDefined();
            expect(server.createObjects).toBeDefined(); // including a ServerCore function
        });

    });

    describe('start()', function() {
        var server;

        beforeEach(function() {
            server = new AbstractServer(CORE_SCHEMAS);
        });

        it('starting replaces the jQuery ajax function', function() {
            var jQueryAjax = $.ajax;
            server.start();

            expect(jQueryAjax).not.toBe($.ajax);
            server.stop();
        });

        it('will throw an error if one tries to start() twice', function() {
            server.start();

            expect(function() {
                server.start();
            }).toDxFail('This server is already started.');
            server.stop();
        });

        it('can be called multiple times with the different servers', function() {
            var server2 = new AbstractServer(CORE_SCHEMAS);
            var server3 = new AbstractServer(CORE_SCHEMAS);
            expect(function() {
                server.start();
                server2.start();
                server3.start();
            }).not.toDxFail();

            server3.stop();
            server2.stop();
            server.stop();
        });

    });

    describe('stop()', function() {
        var server;

        beforeEach(function() {
            server = new AbstractServer(CORE_SCHEMAS);
        });

        it('restores the jquery ajax function', function() {
            var jQueryAjax = $.ajax;
            server.start();

            server.stop();

            expect(jQueryAjax).toBe($.ajax);
        });

        it('restores the jquery ajax function even when our handler is spied upon', function() {
            var jQueryAjax = $.ajax;
            server.start();

            spyOn($, 'ajax');

            server.stop();

            expect(jQueryAjax).toBe($.ajax);
        });

        it('restores the previous $.ajax', function() {
            var server2 = new AbstractServer(CORE_SCHEMAS);

            server.start();
            server2.start();

            server2.stop();
            server.stop();
        });

        it('will throw an error if one tries to stop without starting', function() {
            var newServer = new AbstractServer(CORE_SCHEMAS);

            expect(function() {
                newServer.stop();
            }).toDxFail('This server has not been started.');
        });

        it('will throw an error if one tries to stop it out of sequence', function() {
            var newServer = new AbstractServer(CORE_SCHEMAS);
            server.start();
            newServer.start();

            expect(function() {
                server.stop();
            }).toDxFail('This server is not the active $.ajax handler, and so can not be stopped.');
            newServer.stop();
            server.stop();
        });

    });

    describe('ajax calls', function() {
        var server;

        beforeEach(function() {
            server = new AbstractServer(_.extend({
                '/container.json': {
                    root: '/webapi/container',
                    name: 'Container',
                    extends: {
                        $ref: '/delphix-persistent-object.json'
                    },
                    read: {}
                }
            }, CORE_SCHEMAS));

            server.createObjects([{
                type: 'Container',
                name: 'testObject',
                reference: 'CONTAINER-1'
            }]);
            server.start();
            server._handleUnknownUrl = jasmine.createSpy('handleUnknownUrlSpy');
            server._handleResult = jasmine.createSpy('handleResultSpy');
        });

        afterEach(function() {
            server.stop();
        });

        it('calls handleResult with the result of the call', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1'
            });

            expect(server._handleResult.mostRecentCall.args[0].statusCode).toEqual(200);
            expect(server._handleResult.mostRecentCall.args[0].data.result.type).toEqual('Container');
        });

        it('adds success handler to Result object', function() {
            var successSpy = jasmine.createSpy('successSpy');
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                success: successSpy
            });

            expect(server._handleResult.mostRecentCall.args[0].success).toEqual(successSpy);
        });

        it('adds error handler to Result object', function() {
            var errorSpy = jasmine.createSpy('errorSpy');
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                error: errorSpy
            });

            expect(server._handleResult.mostRecentCall.args[0].error).toEqual(errorSpy);
        });

        it('adds statusCode handler to Result object', function() {
            var successSpy = jasmine.createSpy('successSpy');
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                statusCode: {
                    200: successSpy
                }
            });

            expect(server._handleResult.mostRecentCall.args[0].status).toEqual(successSpy);
        });

        it('can issue a request even if type is lowercase', function() {
            $.ajax({
                type: 'get',
                url: '/webapi/container/CONTAINER-1'
            });

            expect(server._handleResult.mostRecentCall.args[0].statusCode).toEqual(200);
        });

        it('can issue a request with url as the first parameter', function() {
            $.ajax('/webapi/container/CONTAINER-1', {
                type: 'get'
            });

            expect(server._handleResult.mostRecentCall.args[0].statusCode).toEqual(200);
        });

        it('defaults to GET requests', function() {
            $.ajax({
                url: '/webapi/container/CONTAINER-1'
            });

            expect(server._handleResult.mostRecentCall.args[0].statusCode).toEqual(200);
        });

        it('calls nothing if a notification call is made', function() {
            $.ajax({
                type: 'GET',
                url : '/webapi/notification'
            });

            expect(server._handleResult).not.toHaveBeenCalled();
            expect(server._handleUnknownUrl).not.toHaveBeenCalled();
        });

        it('calls _handleUnknownUrl if a call is made to an invalid URL', function() {
            $.ajax({
                type: 'POST',
                url : '/webapi/container'
            });

            expect(server._handleUnknownUrl).toHaveBeenCalled();
        });

        it('calls _handleUnknownUrl trying to post to a url which does not exist', function() {
            $.ajax({
                type: 'POST',
                url : '/boguspie'
            });
            expect(server._handleUnknownUrl).toHaveBeenCalled();
        });

    });

    describe('_handleResult()', function() {

        it('throws an error if called directly (it must be overridden)', function() {
            var server = new AbstractServer(CORE_SCHEMAS);

            expect(function() {
                server._handleResult({});
            }).toDxFail('handleResult() must be overridden.');
        });

    });

    describe('_handleUnknownUrl()', function() {

        it('throws an error if called directly (it must be overridden)', function() {
            var server = new AbstractServer(CORE_SCHEMAS);

            expect(function() {
                server._handleUnknownUrl({});
            }).toDxFail('handleUnknownUrl() must be overridden.');
        });

    });

    describe('_processNotifications()', function() {
        var server;

        beforeEach(function() {
            server = new AbstractServer(_.extend({
                '/container.json': {
                    root: '/webapi/container',
                    name: 'Container',
                    extends: {
                        $ref: '/delphix-persistent-object.json'
                    },
                    create: {},
                    read: {}
                }
            }, CORE_SCHEMAS));
            server._handleResult = jasmine.createSpy('handleResultSpy');
            server.start();
        });

        afterEach(function() {
            server.stop();
        });

        it('does nothing when there are no notification long polls available', function() {
            server._processNotifications();

            expect(server._handleResult).not.toHaveBeenCalled();
        });

        it('returns the notifications', function() {
            server.createObjects([{
                type: 'Container'
            }]);
            $.ajax({
                type: 'GET',
                url: '/webapi/notification',
                dataType: 'json'
            });

            server._processNotifications();

            expect(server._handleResult.mostRecentCall.args[0].statusCode).toEqual(200);
        });

        it('will respond to all notification calls', function() {
            server.createObjects([{
                type: 'Container'
            }]);
            $.ajax({
                type: 'GET',
                url: '/webapi/notification',
                dataType: 'json'
            });
            $.ajax({
                type: 'GET',
                url: '/webapi/notification',
                dataType: 'json'
            });

            server._processNotifications();

            expect(server._handleResult.callCount).toEqual(2);
        });

        it('clears the notifications when processed', function() {
            server.createObjects([{
                type: 'Container'
            }]);
            assert(server.getCollectionLength('Notification')).toEqual(1);
            $.ajax({
                type: 'GET',
                url: '/webapi/notification',
                dataType: 'json'
            });

            server._processNotifications();

            expect(server.getCollectionLength('Notification')).toEqual(0);
        });

    });

    describe('_deliverResult()', function() {
        var server;
        var result;

        beforeEach(function() {
            server = new AbstractServer(CORE_SCHEMAS);
            result = jasmine.createSpyObj('result', ['success', 'error']);
            result.statusCode = 200;
        });

        it('calls success handler on a 210 status', function() {
            server._deliverResult(result);

            expect(result.success.mostRecentCall.args[1]).toEqual('success');
        });

        it('calls success handler on a 304 status', function() {
            result.statusCode = 304;

            server._deliverResult(result);

            expect(result.success.mostRecentCall.args[1]).toEqual('success');
        });

        it('calls error handler on a 100 status', function() {
            result.statusCode = 100;

            server._deliverResult(result);

            expect(result.error.mostRecentCall.args[1]).toEqual('error');
        });

        it('calls error handler on a 300 status', function() {
            result.statusCode = 300;

            server._deliverResult(result);

            expect(result.error.mostRecentCall.args[1]).toEqual('error');
        });

        it('calls status code handler on a 200 status', function() {
            result.status = jasmine.createSpy('200StatusSpy');
            server._deliverResult(result);

            expect(result.status.mostRecentCall.args[1]).toEqual('success');
        });

        it('parses a JSON result if dataType is JSON and return value is a string', function() {
            result.data = '{ "one": 1 }';
            result.dataType = 'JSON';

            server._deliverResult(result);

            expect(result.success.mostRecentCall.args[0]).toEqual({
                one: 1
            });
        });

        it('includes unparsed text in the xhr', function() {
            result.data = '{ "one": 1 }';
            result.dataType = 'JSON';

            server._deliverResult(result);

            expect(result.success.mostRecentCall.args[2].responseText).toEqual('{ "one": 1 }');
        });

        it('calls error handler if ask for JSON data and it can not be parsed', function() {
            result.data = '{ one: 1 }';
            result.dataType = 'JSON';

            server._deliverResult(result);

            expect(result.error.mostRecentCall.args[1]).toEqual('parsererror');
        });

        it('still calls the 200 status code handler on parse failure', function() {
            result.status = jasmine.createSpy('200StatusSpy');
            result.data = '{ one: 1 }';
            result.dataType = 'JSON';

            server._deliverResult(result);

            expect(result.status.mostRecentCall.args[1]).toEqual('parsererror');
        });

        it('evals a script if dataType is script', function() {
            result.data = 'jasmine._testValue = 1;';
            result.dataType = 'SCRIPT';

            server._deliverResult(result);

            expect(jasmine._testValue).toBe(1);
            delete jasmine._testValue;
        });

        it('returns the script as a string', function() {
            result.data = 'jasmine._testValue = 1;';
            result.dataType = 'SCRIPT';

            server._deliverResult(result);

            expect(result.success.mostRecentCall.args[0]).toEqual('jasmine._testValue = 1;');
            delete jasmine._testValue;
        });

        it('calls error handler if script can not be parsed', function() {
            result.data = 'fun ( {;';
            result.dataType = 'SCRIPT';

            server._deliverResult(result);

            expect(result.error.mostRecentCall.args[1]).toEqual('parsererror');
        });

        it('does not call success handler if script can not be parsed', function() {
            result.data = 'fun ( {;';
            result.dataType = 'SCRIPT';

            server._deliverResult(result);

            expect(result.success).not.toHaveBeenCalled();
        });

        describe('responseText', function() {

            it('returns a string version of the data', function() {
                result.data = { one: 1 };

                server._deliverResult(result);

                expect(result.success.mostRecentCall.args[2].responseText)
                    .toEqual('{"one":1}');
            });

        });

        describe('getResponseHeader()', function() {

            it('returns a json data type when the data is json', function() {
                result.data = '{ "one": 1 }';
                result.dataType = 'JSON';

                server._deliverResult(result);

                expect(result.success.mostRecentCall.args[2].getResponseHeader('Content-Type'))
                    .toEqual('application/json');
            });

            it('returns a json data type when the data json-compatible text', function() {
                result.data = '{ "one": 1 }';

                server._deliverResult(result);

                expect(result.success.mostRecentCall.args[2].getResponseHeader('Content-Type'))
                    .toEqual('application/json');
            });

            it('returns a text data type when the data is just text', function() {
                result.data = 'text';

                server._deliverResult(result);

                expect(result.success.mostRecentCall.args[2].getResponseHeader('Content-Type')).toEqual('text/plain');
            });

            it('returns nothing for other headers', function() {
                result.data = 'text';

                server._deliverResult(result);

                expect(result.success.mostRecentCall.args[2].getResponseHeader('Content-Length')).toEqual('');
            });

        });

    });

    describe('debug', function() {
        var server;
        var logLevel;
        var result;

        beforeEach(function() {
            spyOn(dxLog, 'debug');
            logLevel = dxLog.level;
            dxLog.level = dxLog.LEVEL.DEBUG;

            server = new AbstractServer(_.extend({
                '/container.json': {
                    root: '/webapi/container',
                    name: 'Container',
                    extends: {
                        $ref: '/delphix-persistent-object.json'
                    },
                    update: {},
                    read: {}
                }
            }, CORE_SCHEMAS));

            server._handleResult = function(result) {
                server._deliverResult(result);
            };

            server.createObjects([{
                type: 'Container',
                name: 'testObject',
                reference: 'CONTAINER-1'
            }]);
            server.start();
            server.debug = true;

            result = {
                statusCode: 200
            };
        });

        afterEach(function() {
            server.stop();
            dxLog.level = logLevel;
        });

        it('logs no message if debug is not true', function() {
            server.debug = false;

            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1'
            });

            expect(dxLog.debug).not.toHaveBeenCalled();
        });

        it('logs a received message on successful call', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1'
            });

            expect(dxLog.debug.calls[0].args[0])
                .toEqual('Call 1: Receive GET:/webapi/container/CONTAINER-1');
        });

        it('increments call count for each call', function() {
            server.debug = false;
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1'
            });

            server.debug = true;
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1'
            });

            expect(dxLog.debug.calls[0].args[0])
                .toEqual('Call 2: Receive GET:/webapi/container/CONTAINER-1');
        });

        it('logs a message for successful results', function() {
            result.callId = 5;
            result.success = jasmine.createSpy('successCallback');
            server._deliverResult(result);

            expect(dxLog.debug.calls[0].args[0]).toEqual('Call 5: Deliver success');
        });

        it('logs a message for error results', function() {
            result.callId = 5;
            result.statusCode = 500;
            result.error = jasmine.createSpy('errorCallbackSpy');

            server._deliverResult(result);

            expect(dxLog.debug.calls[0].args[0]).toEqual('Call 5: Deliver error');
        });

        it('truncates long data', function() {
            result.callId = 1;

            server._reportDebug(1, 'AMessage', '_________1_________2_________3_________4_________5_________6' +
                '_________7_________8_________9_________A');

            expect(dxLog.debug.calls[0].args[0]).toEqual('Call 1: AMessage "_________1_________2_________3_________4' +
                '_________5_________6_________7_________8_________9________...');
        });

    });

});

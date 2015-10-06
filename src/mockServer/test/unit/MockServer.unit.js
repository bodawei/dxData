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
/*global assert, $ */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');

var MockServer = require('../../MockServer.js');
var CORE_SCHEMAS = require('../shared/coreSchemas.js');

describe('MockServer', function() {
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
                MockServer(CORE_SCHEMAS);
            }).toDxFail('Must call MockServer() with new.');
        });

        it('throws an error if not called with schemas', function() {
            expect(function() {
                new MockServer();
            }).toDxFail('Must pass a map of schemas when constructing a server.');
        });

        it('constructs something with the primary MockServer functions', function() {
            var server = new MockServer(CORE_SCHEMAS);

            expect(server.start).toBeDefined();
            expect(server.stop).toBeDefined();
            expect(server.respond).toBeDefined();
            expect(server.createObjects).toBeDefined(); // including a ServerCore function
        });

    });

    describe('callbacks:', function() {
        var server;
        var successSpy;
        var errorSpy;

        beforeEach(function() {
            server = new MockServer(_.extend({
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
            successSpy = jasmine.createSpy('successSpy');
            errorSpy = jasmine.createSpy('errorSpy');
        });

        afterEach(function() {
            server.stop();
        });

        describe('success', function() {

            it('is called on a successful call', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-1',
                    dataType: 'json',
                    success: successSpy
                });
                server.respond();

                expect(successSpy).toHaveBeenCalled();
            });

            it('will allow an array of callbacks', function() {
                var successSpyTwo = jasmine.createSpy('successSpyTwo');
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-1',
                    dataType: 'json',
                    success: [successSpy, successSpyTwo]
                });
                server.respond();

                expect(successSpy).toHaveBeenCalled();
                expect(successSpyTwo).toHaveBeenCalled();
            });

            it('is not called on a failing call', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-BOGUS',
                    dataType: 'json',
                    success: successSpy
                });
                server.respond();

                expect(successSpy).not.toHaveBeenCalled();
            });

            it('is passed the json data in the first argument', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-1',
                    dataType: 'json',
                    success: successSpy
                });
                server.respond();

                expect(successSpy.mostRecentCall.args[0]).toEqual({
                    type: 'OKResult',
                    result: {
                        type: 'Container',
                        name: 'testObject',
                        reference: 'CONTAINER-1'
                    }
                });
            });

            it('is passed the word "success" as the second argument', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-1',
                    dataType: 'json',
                    success: successSpy
                });
                server.respond();

                expect(successSpy.mostRecentCall.args[1]).toBe('success');
            });

            it('is passed something like a jqXhr as the third argument', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-1',
                    dataType: 'json',
                    success: successSpy
                });
                server.respond();

                var jqXhr = successSpy.mostRecentCall.args[2];
                expect(jqXhr).toHaveProps({
                    readyState: 4,
                    status: 200,
                    statusText: 'OK'
                });
            });

        });

        describe('error', function() {

            it('is not called on a successful call', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-1',
                    dataType: 'json',
                    error: errorSpy
                });
                server.respond();

                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is called on a failing call', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-BOGUS',
                    dataType: 'json',
                    error: errorSpy
                });
                server.respond();

                expect(errorSpy).toHaveBeenCalled();
            });

            it('will allow an array of callbacks', function() {
                var errorSpyTwo = jasmine.createSpy('errorSpyTwo');
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-BOGUS',
                    dataType: 'json',
                    error: [errorSpy, errorSpyTwo]
                });
                server.respond();

                expect(errorSpy).toHaveBeenCalled();
                expect(errorSpyTwo).toHaveBeenCalled();
            });

            it('returns something like a jqXhr as the first argument', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-199',
                    dataType: 'json',
                    error: errorSpy
                });
                server.respond();

                var jqXhr = errorSpy.mostRecentCall.args[0];
                expect(jqXhr).toHaveProps({
                    readyState: 4,
                    status: 404,
                    statusText: 'Not Found'
                });
            });

            it('returns the word "error" as the second argument', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-99',
                    dataType: 'json',
                    error: errorSpy
                });
                server.respond();

                expect(errorSpy.mostRecentCall.args[1]).toBe('error');
            });

            it('returns the http status text in the third argument', function() {
                $.ajax({
                    type: 'GET',
                    url: '/webapi/container/CONTAINER-99',
                    dataType: 'json',
                    error: errorSpy
                });
                server.respond();

                expect(errorSpy.mostRecentCall.args[2]).toBe('Not Found');
            });

        });

        describe('statusCode', function() {

            it('is called on error with expected arguments', function() {
                var errorSpy = jasmine.createSpy('errorSpy');
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-BOGUS',
                    statusCode: {
                        404: errorSpy
                    }
                });
                server.respond();

                expect(errorSpy.mostRecentCall.args[0]).toHaveProps({
                    status: 404
                });
                expect(errorSpy.mostRecentCall.args[1]).toEqual('error');
                expect(errorSpy.mostRecentCall.args[2]).toEqual('Not Found');
            });

            it('is called on success with expected arguments', function() {
                var successSpy = jasmine.createSpy('successSpy');
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1',
                    statusCode: {
                        200: successSpy
                    }
                });
                server.respond();

                expect(successSpy.mostRecentCall.args[0]).toEqual({
                    type: 'OKResult',
                    result: {
                        type: 'Container',
                        name : 'testObject',
                        reference: 'CONTAINER-1'
                    }
                });
                expect(successSpy.mostRecentCall.args[1]).toEqual('success');
                expect(successSpy.mostRecentCall.args[2]).toHaveProps({
                    status: 200
                });
            });

        });

    });

    describe('ajax calls', function() {
        var server;
        var successSpy;

        beforeEach(function() {
            server = new MockServer(_.extend({
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
            successSpy = jasmine.createSpy('successSpy');
        });

        afterEach(function() {
            server.stop();
        });

        it('can issue a request', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                success: successSpy
            });
            server.respond();

            expect(successSpy.mostRecentCall.args[0]).toEqual({
                type: 'OKResult',
                result: {
                    type: 'Container',
                    name: 'testObject',
                    reference: 'CONTAINER-1'
                }
            });
        });

        it('returns ajax results immediately', function() {
            $.ajax({
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                async: false,
                success: successSpy
            });

            expect(successSpy).toHaveBeenCalled();
        });

        it('throws an error if trying to get a url for an operation which does not exist', function() {
            expect(function() {
                $.ajax({
                    type: 'POST',
                    url : '/webapi/container'
                });
            }).toDxFail('The requested resource is not available: POST:/webapi/container');
        });

        it('throws an error if trying to POST to a url which does not exist', function() {
            expect(function() {
                $.ajax({
                    type: 'POST',
                    url : '/boguspie'
                });
            }).toDxFail('The requested resource is not available: POST:/boguspie');
        });

        it('returns a 404 if trying to access a url which does not exist', function() {
            var errorSpy = jasmine.createSpy('errorSpy');

            $.ajax({
                type: 'GET',
                url: '/neverland',
                error: errorSpy
            });

            server.respond();

            expect(errorSpy.mostRecentCall.args[0].status).toBe(404);
        });

    });

    describe('respond()', function() {
        var server;
        var successSpy;

        beforeEach(function() {
            server = new MockServer(_.extend({
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
            }, {
                type: 'Container',
                name: 'secondContainer',
                reference: 'CONTAINER-2'
            }], true);
            server.start();
            successSpy = jasmine.createSpy('successSpy');
        });

        afterEach(function() {
            server.stop();
        });

        it('throws an exception if its parameter is not a function', function() {
            expect(function() {
                server.respond(3);
            }).toDxFail('Filter function, if provided, must be a function.');
        });

        it('delivers all responses, including those generated while calling this', function() {
            var secondSuccess = jasmine.createSpy('secondSuccess');
            var firstSuccess = jasmine.createSpy('firstSuccess').andCallFake(secondCall);
            function secondCall() {
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1',
                    success: secondSuccess
                });
            }
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                success: firstSuccess
            });

            server.respond();

            expect(firstSuccess).toHaveBeenCalled();
            expect(secondSuccess).toHaveBeenCalled();
        });

        it('delivers ajaxComplete events after each call', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                success: successSpy
            });
            var ajaxSpy = jasmine.createSpy('ajaxSpy');

            $(document).on('ajaxComplete', ajaxSpy);
            server.respond();

            expect(ajaxSpy).toHaveBeenCalled();
            $(document).off('ajaxComplete', ajaxSpy);
        });

        it('delivers ajaxComplete events even if there are no callbacks', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1'
            });
            var ajaxSpy = jasmine.createSpy('ajaxSpy');

            $(document).on('ajaxComplete', ajaxSpy);
            server.respond();

            expect(ajaxSpy).toHaveBeenCalled();
            $(document).off('ajaxComplete', ajaxSpy);
        });

        it('delivers no ajaxComplete events when the server has nothing to respond to', function() {
            var ajaxSpy = jasmine.createSpy('ajaxSpy');

            $(document).on('ajaxComplete', ajaxSpy);
            server.respond();

            expect(ajaxSpy).not.toHaveBeenCalled();
            $(document).off('ajaxComplete', ajaxSpy);
        });

        describe('responseFilter', function() {

            it('is not called if there are no responses', function() {
                var filterFunction = jasmine.createSpy('filterFunctionSpy');

                server.respond(filterFunction);

                expect(filterFunction).not.toHaveBeenCalled();
            });

            it('is called if there are no responses but there is something stashed', function() {
                var filterFunction = jasmine.createSpy('filterFunctionSpy');

                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1',
                    success: successSpy
                });

                server.respond(function(response) {
                    response.stash();
                });

                server.respond(filterFunction);

                expect(filterFunction).toHaveBeenCalled();
            });

            it('provides access to the data to be delivered', function() {
                var data;
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1',
                    success: successSpy
                });

                server.respond(function(response) {
                    data = response.getData();
                    response.deliver();
                });

                expect(data).toEqual({
                    type: 'OKResult',
                    result: {
                        type: 'Container',
                        name: 'testObject',
                        reference : 'CONTAINER-1'
                    }
                });
            });

            it('throws an error if no decision is made about what to do with the response', function() {
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1',
                    success: successSpy
                });

                expect(function() {
                    server.respond(function() {});
                }).toDxFail('Must do something with the response.');
            });

            it('throws an error if multiple decisions are made about the response', function() {
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1',
                    success: successSpy
                });

                expect(function() {
                    server.respond(function(response) {
                        response.deliver();
                        response.stash();
                    });
                }).toDxFail('Already delivered this response.');
            });

            it('can deliver the response', function() {
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1',
                    success: successSpy
                });

                server.respond(function(response) {
                    response.deliver();
                });

                expect(successSpy).toHaveBeenCalled();
            });

            it('can stash a response to be used subsequently', function() {
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1',
                    success: successSpy
                });

                server.respond(function(response) {
                    response.stash();
                });
                assert(successSpy).not.toHaveBeenCalled();

                server.respond(function(response, stash) {
                    stash.deliverAll();
                });

                expect(successSpy).toHaveBeenCalled();
            });

            it('can delay a response', function() {
                jasmine.Clock.useMock();
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1',
                    success: successSpy
                });

                server.respond(function(response) {
                    response.delay(10);
                });
                assert(successSpy).not.toHaveBeenCalled();

                jasmine.Clock.tick(10);
                assert(successSpy).not.toHaveBeenCalled();
                server.respond();

                expect(successSpy).toHaveBeenCalled();
            });

            it('increments count on each response', function() {
                var filterSpy = jasmine.createSpy('filterSpy');
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-1'
                });
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: '/webapi/container/CONTAINER-2'
                });

                server.respond(filterSpy.andCallFake(function(response) {
                    response.deliver();
                }));

                expect(filterSpy.calls[0].args[0].index).toEqual(1);
                expect(filterSpy.calls[1].args[0].index).toEqual(2);
            });

        });
    });

    describe('notifications', function() {
        var server;
        var successSpy;

        beforeEach(function() {
            server = new MockServer(_.extend({
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

            server.start();
            successSpy = jasmine.createSpy('successSpy');
        });

        afterEach(function() {
            server.stop();
        });

        it('does not respond to a notification request immediately if no notifications', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: successSpy
            });
            server.respond();

            expect(successSpy).not.toHaveBeenCalled();
        });

        it('will respond later if a notification is created', function() {
            var createSuccessSpy = jasmine.createSpy('createSuccessSpy');
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: successSpy
            });
            server.respond();

            $.ajax({
                type: 'POST',
                dataType: 'json',
                url: '/webapi/container',
                data: '{"type":"Container","name":"newContainer"}',
                success: createSuccessSpy
            });
            server.respond();

            var containerRef = createSuccessSpy.mostRecentCall.args[0].result;

            expect(successSpy.mostRecentCall.args[0]).toEqual({
                type: 'ListResult',
                result: [{
                    type: 'ObjectNotification',
                    eventType: 'CREATE',
                    objectType: 'Container',
                    object: containerRef
                }]
            });
        });

        it('removes notifications once they are returned', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: successSpy
            });

            $.ajax({
                type: 'POST',
                dataType: 'json',
                url: '/webapi/container',
                data: '{"type":"Container","name":"newContainer"}'
            });
            server.respond();

            expect(server.getCollection('Notification')).toEqual([]);
        });

        it('calls a notification callback only the first time it is triggered', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: successSpy
            });

            $.ajax({
                type: 'POST',
                dataType: 'json',
                url: '/webapi/container',
                data: '{"type":"Container","name":"newContainer"}'
            });
            server.respond();

            $.ajax({
                type: 'POST',
                dataType: 'json',
                url: '/webapi/container',
                data: '{"type":"Container","name":"another container"}'
            });
            server.respond();

            expect(successSpy.callCount).toEqual(1);
        });

        it('immediately returns notifications previously created', function() {
            var createSuccessSpy = jasmine.createSpy('createSuccessSpy');
            $.ajax({
                type: 'POST',
                dataType: 'json',
                url: '/webapi/container',
                data: '{"type":"Container","name":"newContainer"}',
                success: createSuccessSpy
            });
            server.respond();
            var containerRef = createSuccessSpy.mostRecentCall.args[0].result;

            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: successSpy
            });
            server.respond();

            expect(successSpy.mostRecentCall.args[0]).toEqual({
                type: 'ListResult',
                result: [{
                    type: 'ObjectNotification',
                    eventType: 'CREATE',
                    objectType: 'Container',
                    object: containerRef
                }]
            });
        });

        it('returns when an non-ajax function like createObjects() creates notifications', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: successSpy
            });

            server.createObjects([{
                type: 'Container',
                name: 'testName'
            }]);
            server.respond();

            expect(successSpy).toHaveBeenCalled();
        });

        it('returns notifications after other results', function() {
            var resultOrder = '';
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: function() {
                    resultOrder += '1';
                }
            });

            $.ajax({
                type: 'POST',
                dataType: 'json',
                url: '/webapi/container',
                data: '{"type":"Container","name":"newContainer"}',
                success: function() {
                    resultOrder += '2';
                }
            });
            server.respond();

            expect(resultOrder).toEqual('21');
        });

        it('responds to multiple outstanding notification calls with the same data', function() {
            var secondNotificationSpy = jasmine.createSpy('secondNotificationSpy');
            var createSuccessSpy = jasmine.createSpy('createSuccessSpy');
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: successSpy
            });
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: secondNotificationSpy
            });
            server.respond();

            $.ajax({
                type: 'POST',
                dataType: 'json',
                url: '/webapi/container',
                data: '{"type":"Container","name":"newContainer"}',
                success: createSuccessSpy
            });
            server.respond();

            var containerRef = createSuccessSpy.mostRecentCall.args[0].result;

            expect(successSpy.mostRecentCall.args[0]).toEqual({
                type: 'ListResult',
                result: [{
                    type: 'ObjectNotification',
                    eventType: 'CREATE',
                    objectType: 'Container',
                    object: containerRef
                }]
            });
            expect(secondNotificationSpy.mostRecentCall.args[0]).toEqual({
                type: 'ListResult',
                result: [{
                    type: 'ObjectNotification',
                    eventType: 'CREATE',
                    objectType: 'Container',
                    object: containerRef
                }]
            });
        });

    });

    describe('debug', function() {
        var server;
        var logLevel;

        beforeEach(function() {
            spyOn(dxLog, 'debug');
            logLevel = dxLog.level;
            dxLog.level = dxLog.LEVEL.DEBUG;

            server = new MockServer(_.extend({
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

            server.createObjects([{
                type: 'Container',
                name: 'testObject',
                reference: 'CONTAINER-1'
            }]);
            server.start();
            server.debug = true;
        });

        afterEach(function() {
            server.stop();
            dxLog.level = logLevel;
        });

        it('logs a message on successful respond', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                success: function() {}
            });

            server.respond();

            expect(dxLog.debug.calls[2].args[0]).toEqual('Call 1: Deliver success');
        });

        it('logs a message for delivered notifications (which are done second)', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: function() {}
            });

            $.ajax({
                type: 'POST',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                data: '{"name":"testName"}',
                success: function() {}
            });

            server.respond();

            expect(dxLog.debug.calls[4].args[0]).toEqual('Call 2: Deliver success');
            expect(dxLog.debug.calls[5].args[0]).toEqual('Call 1: Deliver success');
        });

        it('logs a message on successful respond but no callbacks', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1'
            });

            server.respond();

            expect(dxLog.debug.calls[2].args[0]).toEqual('Call 1: No callbacks');
        });

    });

    describe('reset()', function() {
        var server;
        var successSpy;

        beforeEach(function() {
            jasmine.Clock.useMock();
            server = new MockServer(_.extend({
                '/container.json': {
                    root: '/webapi/container',
                    name: 'Container',
                    extends: {
                        $ref: '/delphix-persistent-object.json'
                    },
                    read: {},
                    list: {}
                }
            }, CORE_SCHEMAS));

            server.createObjects([{
                type: 'Container',
                name: 'testObject',
                reference: 'CONTAINER-1'
            }], true);
            server.start();
            successSpy = jasmine.createSpy('successSpy');
        });

        afterEach(function() {
            server.stop();
        });

        it('delivers empty lists to any outstanding notification calls', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: successSpy
            });

            server.reset();

            expect(successSpy.mostRecentCall.args[0].result).toEqual([]);
        });

        it('can create a new notification request across a reset', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/notification',
                success: function() {
                    $.ajax({
                        type: 'GET',
                        dataType: 'json',
                        url: '/webapi/notification',
                        success: successSpy
                    });
                }
            });
            server.reset();
            assert(successSpy).not.toHaveBeenCalled();
            server.createObjects([{
                type: 'Container'
            }]);

            server.respond();

            expect(successSpy).toHaveBeenCalled();
        });

        it('delivers any items in the stash', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container',
                success: successSpy
            });
            server.respond(function(response) {
                response.stash();
            });

            server.reset();

            expect(successSpy).toHaveBeenCalled();
        });

        it('delivers any items in timeouts', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container',
                success: successSpy
            });
            server.respond(function(response) {
                response.delay(10000);
            });

            server.reset();

            expect(successSpy).toHaveBeenCalled();
        });

        it('will not multiply deliver delayed results multiple times (server removes them after delivery)', function() {
            $.ajax({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container',
                success: successSpy
            });
            server.respond(function(response) {
                response.delay(10000);
            });

            server.reset();
            jasmine.Clock.tick(20000);

            expect(successSpy.callCount).toBe(1);
        });

    });

});

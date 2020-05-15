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
/*global dx, $, _ */

'use strict';

describe('ApiServer', function() {
    var clock

    beforeEach(function() {
        clock = jasmine.clock();
    });

    afterEach(function() {
        clock.uninstall();
    });

    describe('construction', function() {

        it('throws an error if not called with new', function() {
            expect(function() {
                dx.test.ApiServer(dx.test.CORE_SCHEMAS);
            }).toDxFail('Must call ApiServer() with new.');
        });

        it('throws an error if not called with schemas', function() {
            expect(function() {
                new dx.test.ApiServer();
            }).toDxFail('Must pass a map of schemas when constructing a server.');
        });

        it('constructs something with the start() and stop() functions', function() {
            var server = new dx.test.ApiServer(dx.test.CORE_SCHEMAS);

            expect(server.start).toBeDefined();
            expect(server.stop).toBeDefined();
        });

    });

    describe('ajax calls', function() {

        it('calls the mock server when the url is known', function() {
            clock.install();
            var successSpy = jasmine.createSpy('successSpy');
            var server = new dx.test.ApiServer(_.extend({
                '/container.json': {
                    root: '/webapi/container',
                    name: 'Container',
                    extends: {
                        $ref: '/delphix-persistent-object.json'
                    },
                    read: {}
                }
            }, dx.test.CORE_SCHEMAS));
            server.createObjects([{
                type: 'Container',
                name: 'testObject',
                reference: 'CONTAINER-1'
            }]);
            server.start();

            dx.core.ajax.ajaxCall({
                type: 'GET',
                url: '/webapi/container/CONTAINER-1',
                dataType: 'json',
                success: successSpy
            });
            clock.tick(1);

            expect(successSpy.calls.mostRecent().args[0].result.name).toEqual('testObject');
            server.stop();
        });

        it('calls the the real ajax function when the url is not known', function() {
            var jQueryAjax = dx.core.ajax.ajaxCall;
            var mockAjax = jasmine.spyOn('mockAjax');
            dx.core.ajax.ajaxCall = mockAjax;
            var server = new dx.test.ApiServer(dx.test.CORE_SCHEMAS);
            server.start();

            dx.core.ajax.ajaxCall({
                type: 'GET',
                url: '/some/wonderful/resource',
                success: function() {}
            });

            expect(mockAjax.calls.mostRecent().args[0]).toEqual('/some/wonderful/resource');
            server.stop();
            dx.core.ajax.ajaxCall = jQueryAjax;
        });

    });

    describe('result', function() {
        var server;

        beforeEach(function() {
            server = new dx.test.ApiServer(_.extend({
                '/container.json': {
                    root: '/webapi/container',
                    name: 'Container',
                    extends: {
                        $ref: '/delphix-persistent-object.json'
                    },
                    read: {}
                }
            }, dx.test.CORE_SCHEMAS));
            server.createObjects([{
                type: 'Container',
                name: 'testObject',
                reference: 'CONTAINER-1'
            }]);
            server.start();
        });

        afterEach(function() {
            server.stop();
        });

        it('is not delivered immediately', function() {
            clock.install();
            var successSpy = jasmine.createSpy('successSpy');

            dx.core.ajax.ajaxCall({
                type: 'GET',
                url: '/webapi/container/CONTAINER-1',
                dataType: 'json',
                success: successSpy
            });

            expect(successSpy).not.toHaveBeenCalled();
        });

        it('is delivered after a timeout', function() {
            clock.install();
            var successSpy = jasmine.createSpy('successSpy');

            dx.core.ajax.ajaxCall({
                type: 'GET',
                url: '/webapi/container/CONTAINER-1',
                dataType: 'json',
                success: successSpy
            });
            clock.tick(1);

            expect(successSpy.calls.mostRecent().args[0].result.name).toEqual('testObject');
        });

        it('is delivered after a timeout, even when it happens during a previous call', function() {
            clock.install();
            var secondSuccess = jasmine.createSpy('secondSuccess');
            var firstSuccess = jasmine.createSpy('firstSuccess').and.callFake(secondCall);
            function secondCall() {
                setTimeout(function() {
                    dx.core.ajax.ajaxCall({
                        type: 'GET',
                        dataType: 'json',
                        url: '/webapi/container/CONTAINER-1',
                        success: secondSuccess
                    });
                }, 2);
            }

            dx.core.ajax.ajaxCall({
                type: 'GET',
                dataType: 'json',
                url: '/webapi/container/CONTAINER-1',
                success: firstSuccess
            });

            clock.tick(1);

            expect(firstSuccess).toHaveBeenCalled();
            expect(secondSuccess).not.toHaveBeenCalled();

            clock.tick(1);

            expect(firstSuccess).toHaveBeenCalled();
            expect(secondSuccess).toHaveBeenCalled();
        });

    });

    describe('notification', function() {
        var server;
        var successSpy;

        beforeEach(function() {
            server = new dx.test.ApiServer(_.extend({
                '/container.json': {
                    root: '/webapi/container',
                    name: 'Container',
                    extends: {
                        $ref: '/delphix-persistent-object.json'
                    },
                    read: {}
                }
            }, dx.test.CORE_SCHEMAS));
            server.start();
            successSpy = jasmine.createSpy('successSpy');
        });

        afterEach(function() {
            server.stop();
        });

        it('is delivered from createObjects', function() {
            clock.install();
            dx.core.ajax.ajaxCall({
                type: 'GET',
                url: '/webapi/notification',
                dataType: 'json',
                success: successSpy
            });

            server.createObjects([{
                type: 'Container',
                name: 'testObject',
                reference: 'CONTAINER-1'
            }]);

            clock.tick(1);

            expect(successSpy.calls.mostRecent().args[0].result[0].eventType).toEqual('CREATE');
        });

        it('is delivered from updateObjects', function() {
            server.createObjects([{
                type: 'Container',
                name: 'testObject',
                reference: 'CONTAINER-1'
            }], true);

            clock.install();
            dx.core.ajax.ajaxCall({
                type: 'GET',
                url: '/webapi/notification',
                dataType: 'json',
                success: successSpy
            });

            server.updateObjects([{
                type: 'Container',
                name: 'newName',
                reference: 'CONTAINER-1'
            }]);

            clock.tick(1);

            expect(successSpy.calls.mostRecent().args[0].result[0].eventType).toEqual('UPDATE');
        });

        it('is delivered from deleteObjects', function() {
            server.createObjects([{
                type: 'Container',
                name: 'testObject',
                reference: 'CONTAINER-1'
            }], true);

            clock.install();
            dx.core.ajax.ajaxCall({
                type: 'GET',
                url: '/webapi/notification',
                dataType: 'json',
                success: successSpy
            });

            server.deleteObjects([{
                reference: 'CONTAINER-1'
            }]);

            clock.tick(1);

            expect(successSpy.calls.mostRecent().args[0].result[0].eventType).toEqual('DELETE');
        });

    });

});

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
 * Copyright (c) 2013, 2015 by Delphix. All rights reserved.
 */

/*eslint-env jasmine */
/*global dx, Backbone, $, _ */

'use strict';

describe('dx.core.data', function() {
    var SimpleModel = Backbone.Model.extend({});

    describe('newClientModel()', function() {
        var client = {};

        beforeEach(function() {
            var type = {
                name: 'AType'
            };

            dx.core.data.setupDataSystem({t: type}, client);
        });

        it('throws error if passed no parameter', function() {
            expect(function() {
                client.newClientModel();
            }).toDxFail(new Error('To create a new model, a type name must be provided.'));
        });

        it('will throw an error if called with no arguments', function() {
            expect(function() {
                client.newClientModel();
            }).toDxFail(new Error('To create a new model, a type name must be provided.'));
        });

        it('throws error if asked to create a model that doesn\'t exist', function() {
            expect(function() {
                client.newClientModel('badType');
            }).toDxFail(new Error('badType is not a known type name. Can not create one.'));
        });

        it('returns a model when passed a legitimate type', function() {
            var model = client.newClientModel('AType');

            expect(model).toBeDefined();
            expect(model instanceof Backbone.Model).toBe(true);
        });
    });

    describe('getServerModel()', function() {
        var client;
        var server;
        var collection;

        beforeEach(function() {
            var schemas = _.extend({
                t: {
                    root: '/someURL',
                    name: 'AType',
                    list: {
                        'return': {
                            type: 'array',
                            items: {
                                type: 'object',
                                $ref: 't'
                            }
                        }
                    },
                    read: {},
                    properties: {
                        reference: {
                            type: 'string'
                        },
                        type: {
                            type: 'string'
                        },
                        age: {
                            type: 'integer'
                        }
                    }
                }
            }, dx.test.CORE_SCHEMAS);

            client = {};
            dx.core.data.setupDataSystem(schemas, client);
            client._filters.AType = function(collection, model, handler) {
                handler(dx.core.data._filters.INCLUDE);
            };

            server = new dx.test.MockServer(schemas);
            server._filters = _.clone(dx.test._filters);
            server._filters.AType = server._filters._genericFilter;
            server.start();
        });

        afterEach(function() {
            server.stop();
        });

        function fillCollection() {
            server.createObjects([{
                type: 'AType',
                reference: 'REF-1'
            }]);
            collection = client.getServerCollection('AType');
            collection.$$list();
            server.respond();
        }

        it('throws error if passed no parameters', function() {
            expect(function() {
                client.getServerModel();
            }).toDxFail(new Error('A reference and a type must be passed to get the model.'));
        });

        it('throws error if asked to get a model type that doesn\'t exist', function() {
            spyOn(dx, 'warn'); // silence warning messages from server
            expect(function() {
                client.getServerModel('REF-1', 'badType');
            }).toDxFail(new Error('badType is not a known type name.'));
        });

        it('returns a model when passed a legitimate type', function() {
            server.createObjects([{
                type: 'AType',
                reference: 'REF-1'
            }]);
            var model = client.getServerModel('REF-1', 'AType');
            server.respond();

            expect(model).toBeDefined();
            expect(model instanceof Backbone.Model).toBe(true);
        });

        it('triggers badReference event if asked for an object which doesn\'t exist', function() {
            var badRefCallback = jasmine.createSpy('badRefCallback');
            spyOn(client, 'reportErrorResult'); // silence any actual behavior
            spyOn(dx, 'warn'); // silence warning messages from server

            var model = client.getServerModel('REF-2', 'AType');
            model.on('badReference', badRefCallback);
            server.respond();

            expect(badRefCallback).toHaveBeenCalled();
        });

        it('does not re-fetch the model on a second call if the notification system is on', function() {
            client.notification.start();
            server.createObjects([{
                type: 'AType',
                reference: 'REF-2',
                age: 1
            }]);
            var model = client.getServerModel('REF-2', 'AType');
            server.respond();
            expect(model.get('age')).toBe(1);
            server.updateObjects([{
                type: 'AType',
                reference: 'REF-2',
                age: 2
            }]);

            model = client.getServerModel('REF-2', 'AType');

            expect(model.get('age')).toBe(1);
            client.notification.stop();
        });

        it('re-fetches the model on a second call if the notification system is off', function() {
            server.createObjects([{
                type: 'AType',
                reference: 'REF-2',
                age: 1
            }]);
            var model = client.getServerModel('REF-2', 'AType');
            server.respond();
            dx.test.assert(model.get('age')).toBe(1);
            server.updateObjects([{
                type: 'AType',
                reference: 'REF-2',
                age: 2
            }]);

            model = client.getServerModel('REF-2', 'AType');
            server.respond();

            expect(model.get('age')).toBe(2);
        });

        it('returns a model that is already in the collection', function() {
            fillCollection();
            var inCollection = collection.get('REF-1');

            var model = client.getServerModel('REF-1', 'AType');

            expect(model).toBe(inCollection);
        });

        it('triggers "ready" when the model already exists', function() {
            client.notification.start();
            fillCollection();
            var readyCallback = jasmine.createSpy('readyCallback');
            var model = client.getServerModel('REF-1', 'AType');
            model.on('ready', readyCallback);

            expect(readyCallback).toHaveBeenCalled();
            client.notification.stop();
        });

        describe('callbacks', function() {
            it('triggers the ready event when the model is has been retrieved', function() {
                server.createObjects([{
                    type: 'AType',
                    reference: 'REF-1'
                }]);
                var successSpy = jasmine.createSpy('successSpy');
                var model = client.getServerModel('REF-1', 'AType');
                server.respond();

                model.once('ready', successSpy);
                expect(successSpy).toHaveBeenCalled();
            });

            it('triggers the error event when error occurs during fetch', function() {
                var errorSpy = jasmine.createSpy('errorSpy');
                spyOn(dx, 'warn'); // suppress error messages from the mock server

                var model = client.getServerModel('REF-2', 'AType');
                server.respond();

                model.once('error', errorSpy);

                expect(errorSpy).toHaveBeenCalled();
            });

            it('triggers the ready event when the model is already in the collection', function() {
                client.notification.start(); // start the notification system so we won't reach out to server
                var successSpy = jasmine.createSpy('successSpy');
                fillCollection();
                collection.get('REF-1');

                var model = client.getServerModel('REF-1', 'AType');
                model.once('ready', successSpy);

                expect(successSpy).toHaveBeenCalled();
                client.notification.stop();
            });
        });
    });

    describe('getCreationListener', function() {
        var target = {};
        beforeEach(function() {
            var rootless = {
                name: 'Rootless'
            };
            var rooted = {
                root: '/someURL',
                name: 'Rooted',
                list: {},
                properties: {
                    reference: {
                        type: 'string'
                    },
                    type: {
                        type: 'string'
                    }
                }
            };
            var child = {
                name: 'aChildType',
                'extends': {
                    $ref: 'r'
                }
            };

            dx.core.data.setupDataSystem({t: rootless, r: rooted, c: child}, target);
        });

        it('throws error if not passed parameters', function() {
            expect(function() {
                target.getCreationListener();
            }).toDxFail('Settings must be specified.');
        });

        it('throws error if asked to create for a type that doesn\'t exist', function() {
            expect(function() {
                target.getCreationListener({
                    typeName: 'badType',
                    callback: function() {}
                });
            }).toDxFail('badType is not a known type with a list operation. Can not create this creation listener.');
        });

        it('throws error if asked to create a creation listener for a type that exists, but isn\'t a rooted type',
                function() {
            expect(function() {
                target.getCreationListener({
                    typeName: 'Rootless'
                });
            }).toDxFail('Rootless is not a known type with a list operation. Can not create this creation listener.');
        });

        it('throws an error when asked to return a creation listener for a subtype of a rooted type', function() {
            expect(function() {
                target.getCreationListener({
                    typeName: 'aChildType',
                    callback: function() {}
                });
            }).toDxFail('aChildType is not a known type with a list operation. ' +
                    'Can not create this creation listener.');
        });

        it('returns a creation listener for a existing type', function() {
            target._filters.Rooted = function() {};
            expect(target.getCreationListener({
                    typeName: 'Rooted',
                    callback: function() {}
                })).toBeDefined();
        });
    });

    describe('getServerCollection()', function() {
        var client;
        var server;

        beforeEach(function() {
            var schemas = _.extend({
                t: {
                    name: 'Rootless'
                },
                r: {
                    root: '/someURL',
                    name: 'Rooted',
                    list: {},
                    read: {},
                    properties: {
                        reference: {
                            type: 'string'
                        },
                        type: {
                            type: 'string'
                        }
                    }
                },
                c: {
                    name: 'aChildType',
                    extends: {
                        $ref: 'r'
                    }
                }
            }, dx.test.CORE_SCHEMAS);

            client = {};
            dx.core.data.setupDataSystem(schemas, client);
            client._filters.Rooted = function(collection, model, handler) {
                handler(dx.core.data._filters.INCLUDE);
            };

            server = new dx.test.MockServer(schemas);
            server._filters = _.clone(dx.test._filters);
            server._filters.Rooted = server._filters._genericFilter;
            server.start();
        });

        afterEach(function() {
            server.stop();
        });

        it('throws error if asked to create a collection that doesn\'t exist', function() {
            expect(function() {
                client.getServerCollection('badType');
            }).toDxFail(
                new Error('badType is not a known type with a list operation. Can not create this collection.'));
        });

        it('throws error if asked to create a collection for a type that exists, but isn\'t a rooted type', function() {
            expect(function() {
                client.getServerCollection('Rootless');
            }).toDxFail(
                new Error('Rootless is not a known type with a list operation. Can not create this collection.'));
        });

        it('returns a collection for a rooted type', function() {
            expect(client.getServerCollection('Rooted')).toBeDefined();
        });

        it('passes the resetOnList argument through to the collection', function() {
            var collection = client.getServerCollection('Rooted', true);
            expect(collection._resetOnList).toBe(true);
        });

        it('does not have _resetOnList set on the collection if not passed in to getServerCollection', function() {
            var collection = client.getServerCollection('Rooted');
            expect(collection._resetOnList).toBe(false);
        });

        it('does not return the same collection object when called twice', function() {
            var aTypeCollection = client.getServerCollection('Rooted');

            expect(client.getServerCollection('Rooted')).not.toBe(aTypeCollection);
        });

        it('throws an error when asked to return a collection for a subtype of a rooted type', function() {
            expect(function() {
                client.getServerCollection('aChildType');
            }).toDxFail(
                new Error('aChildType is not a known type with a list operation. Can not create this collection.'));
        });

        it('returns a "read only" collection', function() {
            var collection = client.getServerCollection('Rooted');

            expect(function() {
                collection.add(new SimpleModel());
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('doesn\'t trigger a "ready" event on the collection if it isn\'t ready', function() {
            var collection = client.getServerCollection('Rooted');
            var readyCallback = jasmine.createSpy('readyCallback');
            collection.on('ready', readyCallback);

            expect(readyCallback).not.toHaveBeenCalled();
        });

        it('returns an empty collection, when it is first fetched', function() {
            server.createObjects([{ type: 'Rooted', reference: 'REF-1'}]);
            var collection = client.getServerCollection('Rooted');

            expect(collection.length).toBe(0);
        });

        it('triggers a "ready" event on the collection if it is ready', function() {
            server.createObjects([{ type: 'Rooted', reference: 'REF-1'}]);
            var readyCallback = jasmine.createSpy('readyCallback');
            var collection = client.getServerCollection('Rooted');
            collection.on('ready', readyCallback);
            collection.$$list();
            server.respond();

            expect(readyCallback).toHaveBeenCalled();
        });
    });

    describe('getServerSingleton()', function() {
        var singleton;
        var client;
        var server;

        beforeEach(function() {
            var schemas = _.extend({
                t: {
                    root: '/webapi/singleton',
                    name: 'SingletonType',
                    singleton: true,
                    read: {},
                    update: {},
                    properties: {
                        type: {
                            type: 'string'
                        },
                        value: {
                            type: 'number'
                        }
                    }
                },
                n: {
                    name: 'NonSingleton'
                }
            }, dx.test.CORE_SCHEMAS);

            singleton = undefined;
            client = {};
            dx.core.data.setupDataSystem(schemas, client);

            server = new dx.test.MockServer(schemas);
            server.start();
        });

        afterEach(function() {
            server.stop();
        });

        function prepSingleton() {
            server.updateObjects([{
                type: 'SingletonType',
                value: 23
            }]);
            singleton = client.getServerSingleton('SingletonType');
        }

        it('will throw an error if not passed a type name', function() {
            expect(function() {
                client.getServerSingleton();
            }).toDxFail(new Error('A type name must be passed to get the singleton.'));
        });

        it('will throw an error if not passed an unknown type', function() {
            expect(function() {
                client.getServerSingleton('BadType');
            }).toDxFail(new Error('BadType is not a known type name.'));
        });

        it('will throw an error if asked to get a non-singleton', function() {
            expect(function() {
                client.getServerSingleton('NonSingleton');
            }).toDxFail(new Error('NonSingleton is not a singleton.'));
        });

        it('will return a singleton if called with the right type', function() {
            prepSingleton();

            expect(singleton).toBeDefined();
        });

        it('will return a singleton if called with the right type', function() {
            prepSingleton();

            var singleton2 = client.getServerSingleton('SingletonType');
            expect(singleton2).toBe(singleton);
        });

        it('creates singletons which can not be unset()', function() {
            prepSingleton();

            expect(function() {
                singleton.unset();
            }).toDxFail(new Error('Can not modify a server SingletonType instance.'));
        });

        it('creates singletons which can not be clear()\'ed', function() {
            prepSingleton();

            expect(function() {
                singleton.clear();
            }).toDxFail(new Error('Can not modify a server SingletonType instance.'));
        });

        it('creates singletons which can not be sync()\'ed', function() {
            prepSingleton();

            expect(function() {
                singleton.sync();
            }).toDxFail(new Error('Can not modify a server SingletonType instance.'));
        });

        it('creates singletons which can not be set()', function() {
            prepSingleton();

            expect(function() {
                singleton.set();
            }).toDxFail(new Error('Can not modify a server SingletonType instance.'));
        });

        it('triggers an "error" event if the singleton can not be retrieved', function() {
            spyOn(client, 'reportErrorResult'); // silence any actual behavior
            server.addStandardOpHandler('SingletonType', 'read', function(payload, Result) {
                return new Result.ErrorResult(404);
            });
            var errorCallback = jasmine.createSpy('errorCallback');
            jasmine.Clock.useMock();

            var singleton = client.getServerSingleton('SingletonType');
            singleton.on('error', errorCallback);
            server.respond();

            expect(errorCallback).toHaveBeenCalled();
        });

        describe('callbacks', function() {
            it('calls success callback when the singleton is has been retrieved', function() {
                var successSpy = jasmine.createSpy('successSpy');
                server.updateObjects([{
                    type: 'SingletonType',
                    value: 23
                }]);
                client.getServerSingleton('SingletonType', {success: successSpy});
                expect(successSpy).not.toHaveBeenCalled();
                server.respond();

                expect(successSpy).toHaveBeenCalled();
            });

            it('calls error callback when an error occurrs during fetching', function() {
                prepSingleton();
                server.respond();
                server.addStandardOpHandler('SingletonType', 'read', function(payload, Result) {
                    return new Result.ErrorResult(404);
                });
                var errorSpy = jasmine.createSpy('errorSpy');

                client.getServerSingleton('SingletonType', {error: errorSpy});
                server.respond();

                expect(errorSpy).toHaveBeenCalled();
            });

            it('calls success callback when the singleton is already retrieved', function() {
                var successSpy = jasmine.createSpy('successSpy');
                prepSingleton();
                client.getServerSingleton('SingletonType');
                server.respond();

                client.getServerSingleton('SingletonType', { success: successSpy });

                expect(successSpy).toHaveBeenCalled();
            });
        });
    });

    describe('setErrorCallback', function() {
        var target;

        beforeEach(function() {
            target = {};
            dx.core.data.setupDataSystem({
                o: dx.test.dataMocks.okResultSchema,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema,
                n: dx.test.dataMocks.notificationSchema
            }, target);
        });

        it('expects a function to be passed in', function() {
            expect(function() {
                target.setErrorCallback('notAFunction');
            }).toDxFail(new Error('setErrorCallback expects a function as an argument.'));
        });

        it('sets a callback which is called by reportErrorResult', function() {
            spyOn(dx, 'warn');
            var errorCallbackSpy = jasmine.createSpy('errorCallback');
            var result = target.newClientModel('ErrorResult');
            target.setErrorCallback(errorCallbackSpy);
            target.reportErrorResult(result);
            expect(errorCallbackSpy).toHaveBeenCalled();
        });
    });

    describe('Promised ServerModels', function() {
        var serverModel, serverSingleton, successSpy, errorSpy;
        var client;
        var server;

        beforeEach(function() {
            var schemas = _.extend({
                t: {
                    root: '/webapi/atype',
                    name: 'AType',
                    read: {},
                    list: {
                        'return': {
                            type: 'array',
                            items: {
                                type: 'object',
                                $ref: 't'
                            }
                        }
                    },
                    properties: {
                        reference: {
                            type: 'string'
                        },
                        type: {
                            type: 'string'
                        },
                        age: {
                            type: 'integer'
                        }
                    }
                },
                n: {
                    root: '/webapi/singleton',
                    name: 'SingletonType',
                    singleton: true,
                    read: {},
                    properties: {
                        type: {
                            type: 'string'
                        },
                        value: {
                            type: 'number'
                        }
                    }
                }
            }, dx.test.CORE_SCHEMAS);

            client = {};
            dx.core.data.setupDataSystem(schemas, client);

            server = new dx.test.MockServer(schemas);
            server.start();

            successSpy = jasmine.createSpy('success');
            errorSpy = jasmine.createSpy('error');
        });

        afterEach(function() {
            server.stop();
        });

        describe('getServerModelPromise', function() {

            beforeEach(function() {
                server.createObjects([{
                    type: 'AType',
                    reference: 'REF-2',
                    age: 10
                }]);
            });

            it('returns a $ Promise that is resolved when the model\'s "ready" event is triggered', function() {
                client.getServerModelPromise('REF-2', 'AType').done(successSpy).fail(errorSpy);
                server.respond();

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is resolved with the ready ServerModel', function() {
                serverModel = client.getServerModel('REF-2', 'AType');
                client.getServerModelPromise('REF-2', 'AType').done(successSpy);
                server.respond();

                expect(successSpy.mostRecentCall.args[0]).toEqual(serverModel);
            });

            it('is rejected when the model\'s "error" event is triggered', function() {
                spyOn(dx, 'warn'); // suppress server warning
                server.addStandardOpHandler('SingletonType', 'read', function(payload, Result) {
                    return new Result.ErrorResult(404);
                });
                client.getServerModelPromise('whatever', 'AType').done(successSpy).fail(errorSpy);
                server.respond();

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            describe('callbacks', function() {
                it('passes callbacks on to underlying getServerModel routine', function() {
                    var callbacks = {};
                    spyOn(client, 'getServerModel').andCallThrough();

                    client.getServerModelPromise('REF-1', 'AType', callbacks);

                    expect(client.getServerModel.mostRecentCall.args[2]).toBe(callbacks);
                });
            });
        });

        describe('getServerSingletonPromise', function() {

            beforeEach(function() {
                client.notification.start();
            });

            afterEach(function() {
                client.notification.stop();
            });

            function prepareServerSingleton() {
                server.createObjects([{
                    type: 'SingletonType',
                    value: 23
                }]);
            }

            it('returns a $ Promise that is resolved when the model\'s "ready" event is triggered', function() {
                prepareServerSingleton();
                client.getServerSingletonPromise('SingletonType').done(successSpy).fail(errorSpy);
                server.respond();

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is resolved with the ready ServerSingleton', function() {
                prepareServerSingleton();
                client.getServerSingletonPromise('SingletonType').done(successSpy);
                server.respond();

                expect(successSpy.mostRecentCall.args[0].get('type')).toEqual('SingletonType');
            });

            it('is rejected when the model\'s "error" event is triggered', function() {
                spyOn(dx, 'warn'); // suppress message from server
                server.addStandardOpHandler('SingletonType', 'read', function(payload, Result) {
                    return new Result.ErrorResult(404);
                });

                client.getServerSingletonPromise('SingletonType').done(successSpy).fail(errorSpy);
                server.respond();

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            describe('callbacks', function() {
                it('passes callbacks on to underlying getServerSingleton routine', function() {
                    var callbacks = {};
                    prepareServerSingleton();
                    spyOn(client, 'getServerSingleton').andCallThrough();

                    client.getServerSingletonPromise('SingletonType', callbacks);

                    expect(client.getServerSingleton.mostRecentCall.args[1]).toBe(callbacks);
                });
            });

            describe('event listeners', function() {

                it('cleans up "error" event handler in success case', function() {
                    var readySpy = jasmine.createSpy('readySpy');
                    prepareServerSingleton();
                    client.getServerSingletonPromise('SingletonType').done(function(result) {
                        serverSingleton = result;
                    });
                    server.respond();

                    serverSingleton.on('ready', readySpy);
                    expect(readySpy).toHaveBeenCalled();

                    expect(serverSingleton._events.error).toBeUndefined();
                });

                it('cleans up event listeners in the error case', function() {
                    var rejectSpy = jasmine.createSpy('reject');
                    spyOn(dx, 'warn'); // suppress message from server
                    server.addStandardOpHandler('SingletonType', 'read', function(payload, Result) {
                        return new Result.ErrorResult(404);
                    });

                    client.getServerSingletonPromise('SingletonType').fail(rejectSpy);
                    server.respond();

                    expect(rejectSpy).toHaveBeenCalled();

                    expect(serverSingleton._events.ready).toBeUndefined();
                });
            });
        });
    });

    describe('reportErrorResult()', function() {
        var client;

        beforeEach(function() {
            spyOn(dx, 'warn');
            client = {};
            dx.core.data.setupDataSystem({
                o: dx.test.dataMocks.okResultSchema,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema,
                n: dx.test.dataMocks.notificationSchema
            }, client);
        });

        it('reports a stringified version of the ErroResult to dx.warn', function() {
            var result = client.newClientModel('ErrorResult');

            client.reportErrorResult(result);

            expect(dx.warn).toHaveBeenCalled();
        });

        it('throws an error if not passed a valid ErroResult', function() {
            var result = client.newClientModel('ErrorResult');
            result = result.toJSON();

            expect(function() {
                client.reportErrorResult(result);
            }).toDxFail(new Error('reportErrorResult expects an ErrorResult model as an argument.'));
        });

        it('calls errorCallback if one has been defined', function() {
            var errorCallbackSpy = jasmine.createSpy('errorCallback');
            var result = client.newClientModel('ErrorResult');

            client.reportErrorResult(result);
            expect(errorCallbackSpy).not.toHaveBeenCalled();

            client.setErrorCallback(errorCallbackSpy);
            client.reportErrorResult(result);
            expect(errorCallbackSpy).toHaveBeenCalled();
        });
    });

    describe('getCollectionTypeFromModelType()', function() {
        var client;

        beforeEach(function() {
            var grandparent = {
                root: '/nowhere/man',
                name: 'GrandParent'
            };
            var parent = {
                name: 'Parent',
                'extends': {
                    $ref: 'g'
                }
            };
            var child = {
                name: 'Child',
                'extends': {
                    $ref: 'p'
                }
            };
            var noRoot = {
                name: 'NoRoot'
            };

            client = {};
            dx.core.data.setupDataSystem({
                g: grandparent,
                p: parent,
                c: child,
                n: noRoot
            }, client);
        });

       it('throws an error when called with no parameter', function() {
            expect(function() {
                client.getCollectionTypeFromModelType();
            }).toDxFail(new Error('Must call with a type name.'));
       });

       it('throws an error when asked for a type that doesn\'t exist', function() {
            expect(function() {
                client.getCollectionTypeFromModelType('BogusType');
            }).toDxFail(new Error('BogusType is not a known type name.'));
       });

       it('returns undefined when asked for the collection type of a type without a collection parent', function() {
           expect(client.getCollectionTypeFromModelType('NoRoot')).toBeUndefined();
       });

       it('returns grandparent name when child asked about', function() {
           expect(client.getCollectionTypeFromModelType('Child')).toBe('GrandParent');
       });

       it('returns grandparent name when parent asked about', function() {
           expect(client.getCollectionTypeFromModelType('Parent')).toBe('GrandParent');
       });

       it('returns grandparent name when grandparent asked about', function() {
           expect(client.getCollectionTypeFromModelType('GrandParent')).toBe('GrandParent');
       });
    });

    // This test is needed because level3 changes the _lookupModel definition.
    describe('model.get()', function() {
        it('will return referenced objects, even when those are of a type with a parent that has list', function() {
            var model;
            var client = {};
            var server;

            var schemas = _.extend({
                t: {
                    root: '/whatever',
                    name: 'TypeWithReference',
                    extends: {
                        $ref: '/delphix-persistent-object.json'
                    },
                    read: {},
                    properties: {
                        cousin: {
                            type: 'string',
                            format: 'objectReference',
                            referenceTo: 'c'
                        }
                    },
                    list: {}
                },
                c: {
                    name: 'CousinType',
                    'extends': {
                        $ref: 't'
                    }
                }
            }, dx.test.CORE_SCHEMAS);

            dx.core.data.setupDataSystem(schemas, client);

            server = new dx.test.MockServer(schemas);
            server.start();
            server.createObjects([{ type: 'CousinType', reference: 'COUSIN-1'}]);

            model = client._newClientModel('TypeWithReference');
            model.set('cousin', 'COUSIN-1');
            var cousin = model.get('$cousin');
            server.respond();

            expect(cousin instanceof Backbone.Model).toBe(true);
            server.stop();
        });
    });
});

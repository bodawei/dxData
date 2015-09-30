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
/*global dx, _ */

'use strict';

var ServerCore = require('../../ServerCore.js');

describe('ServerCore (handlers)', function() {
    var server;

    var STANDARD_CONTAINER = {
        Container: [ {
            type: 'Container',
            reference: 'CONTAINER-1'
        } ]
    };

    beforeEach(function() {
        server = new ServerCore(_.extend({
            './system-info.json': {
                root: '/api/systeminfo',
                name: 'SystemInfo',
                extends: {
                    $ref: '/delphix-typed-object.json'
                },
                singleton: true,
                read: {
                    return: {
                        type: 'object',
                        $ref: './system-info.json'
                    }
                },
                update: {},
                properties: {
                    productType: {
                        type: 'string'
                    }
                }
            },
            './creatable-singleton.json': {
                root: '/api/creatablesingleton',
                name: 'CreatableSingleton',
                extends: {
                    $ref: '/delphix-typed-object.json'
                },
                singleton: true,
                read: {
                    return: {
                        type: 'object',
                        $ref: './creatable-singleton.json'
                    }
                },
                create: {
                    payload: {
                        type: 'object',
                        $ref: './creatable-params.json'
                    }
                },
                properties: {
                    productType: {
                        type: 'string'
                    }
                }
            },
            './updatable-singleton.json': {
                root: '/api/updatablesingleton',
                name: 'UpdatableSingleton',
                extends: {
                    $ref: '/delphix-typed-object.json'
                },
                singleton: true,
                read: {
                    return: {
                        type: 'object',
                        $ref: './creatable-singleton.json'
                    }
                },
                update: {
                    payload: {
                        type: 'object',
                        $ref: './updatable-singleton.json'
                    }
                },
                properties: {
                    name: {
                        type: 'string'
                    }
                }
            },
            '/creatable-params.json': {
                name: 'CreatableParams',
                extends: {
                    $ref: '/delphix-typed-object.json'
                },
                properties: {
                    newType: {
                        type: 'string'
                    }
                }
            },
            '/no-operations.json': {
                root: '/api/noops',
                name: 'NoOperations',
                extends: {
                    $ref: '/delphix-persistent-object.json'
                }
            },
            '/container.json': {
                root: '/api/container',
                name: 'Container',
                extends: {
                    $ref: '/delphix-persistent-object.json'
                },
                read: {
                    return: {
                        type: 'object',
                        $ref: '/container.json'
                    }
                },
                create: {},
                update: {},
                delete: {},
                list: {
                    parameters: {
                        testParam: {
                            type: 'string'
                        }
                    }
                },
                rootOperations: {
                    doRoot: {
                        payload: {
                            type: 'object'
                        }
                    },
                    doOtherRoot: {
                        payload: {
                            type: 'object'
                        }
                    },
                    doRootParams: {
                        parameters: {
                            param1: 'string'
                        }
                    }
                },
                operations: {
                    doObj: {
                        payload: {
                            type: 'object'
                        }
                    },
                    otherOp: {
                        payload: {
                            type: 'object'
                        }
                    },
                    doParamOp: {
                        parameters: {
                            param1: 'string'
                        }
                    }
                }
            },
            '/sub-container.json': {
                name: 'SubContainer',
                extends: {
                    $ref: '/container.json'
                },
                read: {
                    return: {
                        type: 'object',
                        $ref: '/sub-container.json'
                    }
                }
            },
            '/has-embedded.json': {
                name: 'HasEmbedded',
                extends: {
                    $ref: '/container.json'
                },
                read: {
                    return: {
                        type: 'object',
                        $ref: '/has-embedded.json'
                    }
                },
                properties: {
                    embedded: {
                        type: 'object',
                        $ref: '/container.json'
                    }
                }
            },
            '/misc-types.json': {
                root: '/api/misctypes',
                name: 'MiscTypes',
                extends: {
                    $ref: '/delphix-persistent-object.json'
                },
                create: {},
                update: {},
                list: {},
                read: {
                    return: {
                        type: 'object',
                        $ref: '/misc-types.json'
                    }
                },
                properties: {
                    time: {
                        type: 'string',
                        format: 'date'
                    },
                    nullable: {
                        type: ['string', null]
                    },
                    anArray: {
                        type: 'array'
                    },
                    properties: {
                        type: 'object'
                    },
                    subObject: {
                        type: 'object',
                        $ref: '/misc-types.json'
                    }
                }
            },
            '/nameless-type.json': {
                root: '/api/nameless',
                extends: {
                    $ref: '/delphix-persistent-object.json'
                },
                read: {
                    return: {
                        type: 'object',
                        $ref: '/misc-types.json'
                    }
                },
                rootOperations: {
                    doSomethingNamelessly: {
                        payload: {
                            type: 'object'
                        }
                    }
                }
            },
            '/referenceless.json': {
                root: '/api/referenceless',
                name: 'Referenceless',
                extends: {
                    $ref: '/delphix-typed-object.json'
                },
                read: {
                    return: {
                        type: 'object',
                        $ref: './referenceless.json'
                    }
                }
            },
            '/parameter-type.json': {
                name: 'ParameterType',
                extends: {
                    $ref: '/delphix-typed-object.json'
                }
            }
        }, dx.test.CORE_SCHEMAS));

        server._filters.Container = function(collection) {
            return collection;
        };
    });

    describe('addStandardOpHandlers()', function() {

        it('throws an error if not passed an object', function() {
            expect(function() {
                server.addStandardOpHandlers('hi there');
            }).toDxFail('Expected an object, but got "hi there".');
        });

    });

    describe('addStandardOpHandler()', function() {

        it('throws an error if the type name is not a string', function() {
            expect(function() {
                server.addStandardOpHandler({});
            }).toDxFail('Expected a string as a type name, but got {}.');
        });

        it('throws an error if the operation name is not a string', function() {
            expect(function() {
                server.addStandardOpHandler('Container');
            }).toDxFail('Expected a string as an operation name, but got undefined.');
        });

        it('throws an error if the handler is not a function', function() {
            expect(function() {
                server.addStandardOpHandler('Container', 'read', 'doit');
            }).toDxFail('Expected a function for the handler, but got "doit".');
        });

        it('throws an error if the type name is not a schema name', function() {
            expect(function() {
                server.addStandardOpHandler('Fish', 'read', function() {});
            }).toDxFail('Fish is not a schema type.');
        });

        it('throws an error if operation name is not one of the standard operations', function() {
            expect(function() {
                server.addStandardOpHandler('Container', 'doObj', function() {});
            }).toDxFail('doObj is not one of the standard operations (list, read, create, update, delete).');
        });

        it('throws an error if the type does not have the specified operation', function() {
            expect(function() {
                server.addStandardOpHandler('NoOperations', 'read', function() {});
            }).toDxFail('read is not a standard operation on NoOperations.');
        });

        it('will register a function that can be called', function() {
            var readSpy = jasmine.createSpy('SystemInfo.readSpy')
                .andCallFake(function(payload, Result) {
                    return new Result(200, null);
                });

            server.addStandardOpHandler('SystemInfo', 'read', readSpy);
            server.GET('/api/systeminfo');

            expect(readSpy).toHaveBeenCalled();
        });

    });

    describe('addRootOpHandlers()', function() {
        var rootOpHandler;

        beforeEach(function() {
            rootOpHandler = function(payload, Result) {
                return new Result(200, null);
            };
        });

        it('will accept no operations', function() {
            expect(function() {
                server.addRootOpHandlers({});
            }).not.toThrow();
        });

        it('throws an error if asked to invoke a function with no handler (test-writer mistake)', function() {
            server.addRootOpHandlers({});

            expect(function() {
                server.POST('/api/container/doRoot');
            }).toDxFail('Test called Container.doRoot, but no handler registered for it.');
        });

        it('will register a function that can be called', function() {
            var doObjOperation = jasmine.createSpy('export').andCallFake(rootOpHandler);

            server.addRootOpHandlers({
                Container: {
                    doRoot: doObjOperation
                }
            });

            server.POST('/api/container/doRoot');
            expect(doObjOperation).toHaveBeenCalled();
        });

        it('will set root operations for schemas without a name using the schemaKey', function() {
            var rootOpSpy = jasmine.createSpy('rootOpSpy').andCallFake(rootOpHandler);

            server.addRootOpHandlers({
                nameless_type: {
                    doSomethingNamelessly: rootOpSpy
                }
            });

            server.POST('/api/nameless/doSomethingNamelessly');
            expect(rootOpSpy).toHaveBeenCalled();
        });

        it('doesn\'t change existing operations', function() {
            var rootOperation = jasmine.createSpy('doRootSpy').andCallFake(rootOpHandler);
            var otherOperation = jasmine.createSpy('doOtherRootSpy');

            server.addRootOpHandler('Container', 'doRoot', rootOperation);
            server.addRootOpHandler('Container', 'doOtherRoot', otherOperation);

            server.POST('/api/container/doRoot');
            expect(rootOperation).toHaveBeenCalled();
        });

        it('overrides root operations', function() {
            var rootOperation = jasmine.createSpy('export');
            var newRootOperation = jasmine.createSpy('newExportOperation').andCallFake(rootOpHandler);

            server.addRootOpHandlers({
                Container: {
                    doRoot: rootOperation
                }
            });
            server.addRootOpHandlers({
                Container: {
                    doRoot: newRootOperation
                }
            });

            server.POST('/api/container/doRoot');
            expect(newRootOperation).toHaveBeenCalled();
        });
    });

    describe('addRootOpHandler()', function() {

        it('throws an error if the type name is not a string', function() {
            expect(function() {
                server.addRootOpHandler({});
            }).toDxFail('Expected a string as a type name, but got {}.');
        });

        it('throws an error if the operation name is not a string', function() {
            expect(function() {
                server.addRootOpHandler('Container');
            }).toDxFail('Expected a string as an operation name, but got undefined.');
        });

        it('throws an error if the handler is not a function', function() {
            expect(function() {
                server.addRootOpHandler('Container', 'export', 'doit');
            }).toDxFail('Expected a function for the handler, but got "doit".');
        });

        it('throws an error if the type name is not a schema name', function() {
            expect(function() {
                server.addRootOpHandler('Fish', 'export', function() {});
            }).toDxFail('Fish is not a schema type.');
        });

        it('throws an error if the operation is not a root operation', function() {
            expect(function() {
                server.addRootOpHandler('Container', 'doObj', function() {});
            }).toDxFail('doObj is not a root operation on Container.');
        });

        it('throws an error if the operation is not a root operation on a type with no root ops', function() {
            expect(function() {
                server.addRootOpHandler('Container', 'bogusOp', function() {});
            }).toDxFail('bogusOp is not a root operation on Container.');
        });

        it('will register a function that can be called', function() {
            var doRootSpy = jasmine.createSpy('Container.doRootSpy')
                .andCallFake(function(payload, Result) {
                    return new Result(200, null);
                });

            server.addRootOpHandler('Container', 'doRoot', doRootSpy);

            server.POST('/api/container/doRoot');
            expect(doRootSpy).toHaveBeenCalled();
        });

        it('will register a parameters function that can be called via GET', function() {
            server.createObjects(STANDARD_CONTAINER);

            server.addRootOpHandler('Container', 'doRootParams', function(parameters, Result) {
                return new Result.OkResult(parameters);
            });

            var result = server.GET('/api/container/doRootParams', {param1: 'foo'});
            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: {
                        param1: 'foo'
                    }
                }
            });
        });

    });

    describe('addObjectOpHandlers()', function() {
        var objectOpHandler;

        beforeEach(function() {
            objectOpHandler = function(reference, payload, Result) {
                return new Result.OkResult(null);
            };
        });

        it('will accept no operations', function() {
            expect(function() {
                server.addObjectOpHandlers({});
            }).not.toThrow();
        });

        it('will register a function that can be called via POST', function() {
            var refParam;
            server.createObjects(STANDARD_CONTAINER);

            server.addObjectOpHandlers({
                Container: {
                    doObj: function(reference, payload, Result) {
                        refParam = reference;
                        return new Result.OkResult(refParam);
                    }
                }
            });

            server.POST('/api/container/CONTAINER-1/doObj');
            expect(refParam).toBe('CONTAINER-1');
        });

        it('will register a parameters function that can be called via GET of a parameters', function() {
            var doParamObjSpy = jasmine.createSpy('doParamObjSpy');
            server.createObjects(STANDARD_CONTAINER);
            server.addObjectOpHandler('Container', 'doParamOp', doParamObjSpy);

            server.GET('/api/container/CONTAINER-1/doParamOp', {param1: 'foo'});

            expect(doParamObjSpy).toHaveBeenCalled();
        });

        it('throws an error if asked to invoke an operation with no handler registered', function() {
            server.createObjects(STANDARD_CONTAINER);

            server.addObjectOpHandlers({});

            expect(function() {
                server.POST('/api/container/CONTAINER-1/doObj');
            }).toDxFail();
        });

        it('will report a 404 error if asked to operate on a nonexistent object', function() {
            server.addObjectOpHandlers({
                Container: {
                    doObj: function() {}
                }
            });

            var result = server.POST('/api/container/CONTAINER-1/doObj');

            expect(result.statusCode).toBe(404);
        });

        it('doesn\'t change existing operations', function() {
            var doObjOperation = jasmine.createSpy('doObjSpy').andCallFake(objectOpHandler);
            var otherOperation = jasmine.createSpy('otherOpSpy');

            server.createObjects(STANDARD_CONTAINER);

            server.addObjectOpHandlers({
                Container: {
                    doObj: doObjOperation
                }
            });
            server.addObjectOpHandlers({
                Container: {
                    otherOp: otherOperation
                }
            });

            server.POST('/api/container/CONTAINER-1/doObj');

            expect(doObjOperation).toHaveBeenCalled();
        });

        it('overrides object operations', function() {
            var doObjOperation = jasmine.createSpy('doObj');
            var newSyncOperation = jasmine.createSpy('newSync').andCallFake(objectOpHandler);

            server.createObjects(STANDARD_CONTAINER);

            server.addObjectOpHandlers({
                Container: {
                    doObj: doObjOperation
                }
            });
            server.addObjectOpHandlers({
                Container: {
                    doObj: newSyncOperation
                }
            });

            server.POST('/api/container/CONTAINER-1/doObj');

            expect(newSyncOperation).toHaveBeenCalled();
            expect(doObjOperation).not.toHaveBeenCalled();
        });
    });

    describe('addObjectOpHandler()', function() {

        it('throws an error if the type name is not a string', function() {
            expect(function() {
                server.addObjectOpHandler({});
            }).toDxFail('Expected a string as a type name, but got {}.');
        });

        it('throws an error if the operation name is not a string', function() {
            expect(function() {
                server.addObjectOpHandler('Container');
            }).toDxFail('Expected a string as an operation name, but got undefined.');
        });

        it('throws an error if the handler is not a function', function() {
            expect(function() {
                server.addObjectOpHandler('Container', 'doObj', 'doit');
            }).toDxFail('Expected a function for the handler, but got "doit".');
        });

        it('throws an error if the type name is not a schema name', function() {
            expect(function() {
                server.addObjectOpHandler('Fish', 'doObj', function() {});
            }).toDxFail('Fish is not a schema type.');
        });

        it('throws an error if the operation is not an object operation', function() {
            expect(function() {
                server.addObjectOpHandler('Container', 'provision', function() {});
            }).toDxFail('provision is not an object operation on Container.');
        });

        it('throws an error if the operation is not an object operation on a type with no operations', function() {
            expect(function() {
                server.addObjectOpHandler('MiscTypes', 'doObj', function() {});
            }).toDxFail('doObj is not an object operation on MiscTypes.');
        });

        it('will register a function that can be called', function() {
            server.createObjects(STANDARD_CONTAINER);
            var doObjSpy = jasmine.createSpy('Container.doObjSpy')
                .andCallFake(function(reference, payload, Result) {
                    return new Result(200, null);
                });
            server.addObjectOpHandler('Container', 'doObj', doObjSpy);

            server.POST('/api/container/CONTAINER-1/doObj', {});

            expect(doObjSpy).toHaveBeenCalled();
        });

    });

    describe('addResources()', function() {

        it('will accept no resources', function() {
            expect(function() {
                server.addResources({});
            }).not.toThrow();
        });

        it('will register resources that can be requested', function() {
            server.addResources({
                '/somewhere': 'out there'
            });

            var result = server.GET('/somewhere');

            expect(result).toEqual({
                statusCode: 200,
                data: 'out there'
            });
        });

    });

    describe('standard operation handlers', function() {

        describe('for singletons', function() {

            describe('create', function() {

                it('creates an object', function() {
                    server.POST('/api/creatablesingleton', {
                        type: 'CreatableSingleton',
                        productType: 'testValue'
                    });

                    expect(server.getSingleton('CreatableSingleton')).toEqual({
                        type: 'CreatableSingleton',
                        productType: 'testValue'
                    });
                });

                it('creates an object even when the type is not specified', function() {
                    server.POST('/api/creatablesingleton', {
                        productType: 'testValue'
                    });

                    expect(server.getSingleton('CreatableSingleton')).toEqual({
                        type: 'CreatableSingleton',
                        productType: 'testValue'
                    });
                });

                it('returns 200/OkResult/null', function() {
                    var result = server.POST('/api/creatablesingleton', {
                        type: 'CreatableSingleton',
                        productType: 'testValue'
                    });

                    expect(result).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'OKResult',
                            result: null
                        }
                    });
                });

                it('creates a CREATE notification for the created object', function() {
                    server.POST('/api/creatablesingleton', {
                        productType: 'testValue'
                    });

                    var notifications = server.getCollection('Notification');
                    expect(_.find(notifications, function(item) { return item.objectType === 'CreatableSingleton'; }))
                        .toEqual({
                            type: 'SingletonUpdate',
                            objectType: 'CreatableSingleton'
                        });
                });

            });

            describe('update', function() {

                it('updates the specified object', function() {
                    server.POST('/api/updatablesingleton', {
                        name: 'newValue'
                    });

                    expect(server.getSingleton('UpdatableSingleton').name).toEqual('newValue');
                });

                it('uses the url type in preference to the type passed', function() {
                    server.POST('/api/updatablesingleton', {
                        type: 'BogusType',
                        name: 'newValue'
                    });

                    expect(server.getSingleton('UpdatableSingleton').name).toEqual('newValue');
                });

                it('returns 200/null on successful update', function() {
                    var result = server.POST('/api/updatablesingleton', {
                        name: 'newValue'
                    });

                    expect(result).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'OKResult',
                            result: null
                        }
                    });
                });

                it('creates an UPDATE notification for the object', function() {
                    server.POST('/api/updatablesingleton', {
                        name: 'newValue'
                    });

                    var notifications = server.getCollection('Notification');
                    expect(_.find(notifications, function(item) { return item.objectType === 'UpdatableSingleton'; }))
                        .toEqual({
                            type: 'SingletonUpdate',
                            objectType: 'UpdatableSingleton'
                        });
                });

            });

            describe('read', function() {

                it('returns the specified object', function() {
                    var result = server.GET('/api/creatablesingleton');

                    expect(result).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'OKResult',
                            result: {
                                type: 'CreatableSingleton'
                            }
                        }
                    });
                });

            });

        });

        describe('for collection objects: ', function() {

            beforeEach(function() {
                server.createObjects([{
                    type: 'Container',
                    reference: 'CONTAINER-1',
                    name: 'startName'
                }]);
            });

            describe('create', function() {

                it('creates an object', function() {
                    server.POST('/api/container', {
                        type: 'Container',
                        name: 'testObject'
                    });

                    expect(server.getObject('CONTAINER-1000')).toEqual({
                        type: 'Container',
                        reference: 'CONTAINER-1000',
                        name: 'testObject'
                    });
                });

                it('returns the a reference to the created object', function() {
                    var result = server.POST('/api/container', {
                        type: 'Container',
                        name: 'testObject'
                    });

                    expect(result).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'OKResult',
                            result: 'CONTAINER-1000'
                        }
                    });
                });

                it('creates a CREATE notification for the created object', function() {
                    server.POST('/api/container', {
                        type: 'Container',
                        name: 'testObject'
                    });

                    var notifications = server.getCollection('Notification');
                    expect(_.find(notifications, function(item) { return item.object === 'CONTAINER-1000'; })).toEqual({
                        type: 'ObjectNotification',
                        eventType: 'CREATE',
                        objectType: 'Container',
                        object: 'CONTAINER-1000'
                    });
                });

                it('allows for creating subtypes', function() {
                    expect(server.POST('/api/container', {
                        type: 'SubContainer',
                        name: 'testObject'
                    })).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'OKResult',
                            result: 'SUBCONTAINER-1000'
                        }
                    });
                });

                it('throws an error if trying to pass something other than the defined type', function() {
                    expect(function() {
                        server.POST('/api/container', {
                            type: 'MiscTypes',
                            name: 'testObject'
                        });
                    }).toDxFail('Trying to create a Container but received a payload of type MiscTypes. Use ' +
                        'addStandardOpHandlers() to roll your own create logic.');
                });

                it('throws an error if trying to create a type that is not a schema type', function() {
                    expect(function() {
                        server.POST('/api/container', {
                            type: 'SomeOtherType'
                        });
                    }).toDxFail('SomeOtherType is not a known schema type.');
                });

                it('assumes the default schema type if payload has no type', function() {
                    var result = server.POST('/api/container', {});

                    expect(result).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'OKResult',
                            result: 'CONTAINER-1000'
                        }
                    });
                });

            });

            describe('update', function() {

                it('updates the specified object', function() {
                    server.POST('/api/container/CONTAINER-1', {
                        type: 'Container',
                        name: 'testObject'
                    });

                    expect(server.getObject('CONTAINER-1').name).toEqual('testObject');
                });

                it('uses the url reference in preference to the reference passed', function() {
                    server.POST('/api/container/CONTAINER-1', {
                        type: 'Container',
                        name: 'testObject',
                        reference: 'CONTAINER-99'
                    });

                    expect(server.getObject('CONTAINER-1').name).toEqual('testObject');
                });

                it('returns 200/null on successful update', function() {
                    var result = server.POST('/api/container/CONTAINER-1', {
                        type: 'Container',
                        name: 'testObject'
                    });

                    expect(result).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'OKResult',
                            result: null
                        }
                    });
                });

                it('creates an UPDATE notification for the object', function() {
                    server.POST('/api/container/CONTAINER-1', {
                        type: 'Container',
                        name: 'testObject'
                    });

                    var notifications = server.getCollection('Notification');
                    expect(_.find(notifications, function(item) { return item.eventType === 'UPDATE'; })).toEqual({
                        type: 'ObjectNotification',
                        eventType: 'UPDATE',
                        objectType: 'Container',
                        object: 'CONTAINER-1'
                    });
                });

                it('returns 404/ErrorResult if trying to update an object that is not on the server', function() {
                    var result = server.POST('/api/container/CONTAINER-BOGUS', {
                        type: 'Container',
                        name: 'testObject'
                    });

                    expect(result).toEqual({
                        statusCode: 404,
                        data: {
                            type: 'ErrorResult',
                            status: 'ERROR',
                            error: {
                                type: 'APIError',
                                details: 'Container/CONTAINER-BOGUS could not be found for update.',
                                id: 'object.missing'
                            }
                        }
                    });
                });

                it('updates sub-objects of the target object', function() {
                    var reference = server.createObjects([{
                        type: 'MiscTypes',
                        subObject: {
                            type: 'MiscTypes',
                            time: new Date(1000000000000)
                        }
                    }]);

                    server.POST('/api/misctypes/' + reference[0], {
                        subObject: {
                            time: new Date(1429983070186)
                        }
                    });

                    expect(server.getObject(reference[0], 'MiscTypes').subObject.time)
                        .toEqual('2015-04-25T17:31:10.186Z');
                });

                it('updates plain array properties of the target object', function() {
                    var reference = server.createObjects([{
                        type: 'MiscTypes',
                        anArray: [1, 2, 3]
                    }]);

                    server.POST('/api/misctypes/' + reference[0], {
                        anArray: ['a', 2, true]
                    });

                    expect(server.getObject(reference[0], 'MiscTypes').anArray).toEqual(['a', 2, true]);
                });

                it('updates plain object properties of the target object', function() {
                    var reference = server.createObjects([{
                        type: 'MiscTypes',
                        properties: { name: 'testName' }
                    }]);

                    server.POST('/api/misctypes/' + reference[0], {
                        properties: { age: 'testName23' }
                    });

                    expect(server.getObject(reference[0], 'MiscTypes').properties).toEqual({ age: 'testName23' });
                });

            });

            describe('delete', function() {

                it('deletes the specified object', function() {
                    server.DELETE('/api/container/CONTAINER-1');

                    expect(server.getObject('CONTAINER-1')).toBeUndefined();
                });

                it('ignores payload information', function() {
                    server.DELETE('/api/container/CONTAINER-1', {
                        type: 'Container',
                        reference: 'CONTAINER-99'
                    });

                    expect(server.getObject('CONTAINER-1')).toBeUndefined();
                });

                it('returns 200/null on successful delete', function() {
                    var result = server.DELETE('/api/container/CONTAINER-1');

                    expect(result).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'OKResult',
                            result: null
                        }
                    });
                });

                it('creates a DELETE notification for the object', function() {
                    server.DELETE('/api/container/CONTAINER-1');

                    var notifications = server.getCollection('Notification');
                    expect(_.find(notifications, function(item) { return item.eventType === 'DELETE'; })).toEqual({
                        type: 'ObjectNotification',
                        eventType: 'DELETE',
                        objectType: 'Container',
                        object: 'CONTAINER-1'
                    });
                });

                it('returns 404/ErrorResult if trying to delete an object that is not on the server', function() {
                    var result = server.DELETE('/api/container/CONTAINER-BOGUS');

                    expect(result).toEqual({
                        statusCode: 404,
                        data: {
                            type: 'ErrorResult',
                            status: 'ERROR',
                            error: {
                                type: 'APIError',
                                details: 'Container/CONTAINER-BOGUS could not be found for delete.',
                                id: 'object.missing'
                            }
                        }
                    });
                });

            });

            describe('read', function() {

                it('returns the specified object', function() {
                    expect(server.GET('/api/container/CONTAINER-1')).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'OKResult',
                            result: {
                                type: 'Container',
                                name: 'startName',
                                reference: 'CONTAINER-1'
                            }
                        }
                    });
                });

                it('returns a 404/ErrorResult Result if the object is not found', function() {
                    expect(server.GET('/api/container/CONTAINER-99')).toEqual({
                        statusCode: 404,
                        data: {
                            type: 'ErrorResult',
                            status: 'ERROR',
                            error: {
                                type: 'APIError',
                                details: 'Container/CONTAINER-99 could not be found for read.',
                                id: 'object.missing'
                            }
                        }
                    });
                });

            });

            describe('list', function() {

                it('returns the specified collection', function() {
                    expect(server.GET('/api/container')).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'ListResult',
                            result: [{
                                type: 'Container',
                                name: 'startName',
                                reference: 'CONTAINER-1'
                            }]
                        }
                    });
                });

                it('returns an empty collection if there are no objects in it', function() {
                    expect(server.GET('/api/misctypes')).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'ListResult',
                            result: []
                        }
                    });
                });

                it('returns the same set of objects each time it is called', function() {
                    var result1 = server.GET('/api/container');
                    var result2 = server.GET('/api/container');

                    expect(result1).toEqual(result2);
                    expect(result1).toEqual({
                        statusCode: 200,
                        data: {
                            type: 'ListResult',
                            result: [{
                                type: 'Container',
                                reference: 'CONTAINER-1',
                                name : 'startName'
                            }]
                        }
                    });
                });

                it('does not clear notifications when queried', function() {
                    var expected = {
                        statusCode: 200,
                        data: {
                            type: 'ListResult',
                            result: [{
                                type: 'ObjectNotification',
                                eventType: 'CREATE',
                                objectType: 'Container',
                                object : 'CONTAINER-1'
                            }]
                        }
                    };
                    var result1 = server.GET('/webapi/notification');
                    var result2 = server.GET('/webapi/notification');

                    expect(result1).toEqual(expected);
                    expect(result2).toEqual(expected);
                });

                // The filter functions are tested separately in the filter module
                it('uses a filter function for a list with query parameters', function() {
                    spyOn(server._filters, 'Container').andCallThrough();
                    server.GET('/api/container',  {testParam: 'hi'});

                    expect(server._filters.Container).toHaveBeenCalled();
                });

            });

        });

    });

    describe('custom standard operation handlers', function() {

        var listSpy, createSpy, readSpy, updateSpy, deleteSpy;
        var staticMockHandler;
        var objectMockHandler;

        beforeEach(function() {
            staticMockHandler = function(payloadOrParameters, Result) {
                return new Result(200, null);
            };
            objectMockHandler = function(reference, payloadOrParameters, Result) {
                return new Result(200, null);
            };

            listSpy = jasmine.createSpy('list').andCallFake(staticMockHandler);
            createSpy = jasmine.createSpy('create').andCallFake(staticMockHandler);
            readSpy = jasmine.createSpy('read').andCallFake(objectMockHandler);
            updateSpy = jasmine.createSpy('update').andCallFake(objectMockHandler);
            deleteSpy = jasmine.createSpy('delete').andCallFake(objectMockHandler);

            server.addStandardOpHandlers({
                Container: {
                    list: listSpy,
                    create: createSpy,
                    read: readSpy,
                    update: updateSpy,
                    delete: deleteSpy
                },
                SystemInfo: {
                    read: readSpy,
                    update: updateSpy
                },
                CreatableSingleton: {
                    read: readSpy,
                    create: createSpy
                }
            });

            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'startName'
            }, {
                type: 'SystemInfo'
            }]);
        });

        describe('create', function() {

            it('can create a singleton object through custom handler', function() {
                createSpy.andCallFake(function(payload, Result) {
                    server.createObjects([{
                        type: 'CreatableSingleton',
                        productType: payload.newType
                    }]);
                    return new Result.OkResult(null);
                });

                server.POST('/api/creatablesingleton', {
                    type: 'CreatableParams',
                    newType: 'testValue'
                });

                expect(server.getSingleton('CreatableSingleton').productType).toEqual('testValue');
            });

            it('can create a collection object through a custom handler', function() {
                createSpy.andCallFake(function(payload, Result) {
                    server.createObjects([_.extend({
                        type: 'Container',
                        reference: 'CONTAINER-TEST'
                    }, payload)]);

                    return new Result.OkResult('CONTAINER-TEST');
                });

                server.POST('/api/container', {
                    name: 'testName'
                });

                expect(server.getCollection('Container')[1]).toEqual({
                    type: 'Container',
                    reference: 'CONTAINER-TEST',
                    name: 'testName'
                });
            });

            it('calls the custom handler for a singleton "create" operation with expected arguments', function() {
                server.POST('/api/creatablesingleton', {
                    type: 'CreatableSingleton',
                    productType: 'testValue'
                });

                expect(createSpy.mostRecentCall.args[0]).toEqual({
                    type: 'CreatableSingleton',
                    productType: 'testValue'
                });
                expect(_.isFunction(createSpy.mostRecentCall.args[1])).toEqual(true);
                expect(createSpy.mostRecentCall.args[2]).toBe(server);
            });

            it('returns a Result object when creating a singleton', function() {
                createSpy.andCallFake(function(payload, Result) {
                    return new Result.OkResult(null);
                });

                var result = server.POST('/api/creatablesingleton');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: null
                    }
                });
            });

            it('returns a result object when creating a collection object', function() {
                createSpy.andCallFake(function(payload, Result) {
                    return new Result.OkResult('CONTAINER-TEST');
                });

                var result = server.POST('/api/container');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: 'CONTAINER-TEST'
                    }
                });
            });

            it('calls the custom handler for a collection object create operation with expected arguments', function() {
                server.POST('/api/container', {
                    type: 'Container',
                    reference: 'CONTAINER-TEST',
                    name: 'testValue'
                });

                expect(createSpy.mostRecentCall.args[0]).toEqual({
                    type: 'Container',
                    reference: 'CONTAINER-TEST',
                    name: 'testValue'
                });
                expect(_.isFunction(createSpy.mostRecentCall.args[1])).toEqual(true);
                expect(createSpy.mostRecentCall.args[2]).toBe(server);
            });

            it('ultimately returns 200/null Result object when the object handler returns undefined', function() {
                createSpy.andReturn(undefined);

                var result = server.POST('/api/container');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: null
                    }
                });
            });

            it('ultimately returns 200/null Result object when the singleton handler returns undefined', function() {
                createSpy.andReturn(undefined);

                var result = server.POST('/api/creatablesingleton');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: null
                    }
                });
            });

            it('wraps return value in an OKResult if the singleton create return is not a Result', function() {
                createSpy.andReturn('CreatableType');

                var result = server.POST('/api/creatablesingleton', {
                    type: 'CreatableParams',
                    newType: 'testValue'
                });

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: 'CreatableType'
                    }
                });
            });

            it('wraps return value from custom collection object create handler if it isn not a Result', function() {
                createSpy.andReturn('REFERENCE-1');

                var result = server.POST('/api/container', {
                    type: 'Container',
                    name: 'testValue'
                });

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: 'REFERENCE-1'
                    }
                });
            });

        });

        describe('update', function() {

            it('can update a singleton update through custom handler', function() {
                var newHostname = 'new hostname';
                updateSpy.andCallFake(function(payload, Result) {
                    var existingSingleton = server.getSingleton('SystemInfo');
                    _.extend(existingSingleton, payload);
                    server.updateObjects([existingSingleton]);
                    return new Result.OkResult(null);
                });

                server.POST('/api/systeminfo', {
                    hostname: newHostname
                });

                expect(server.getSingleton('SystemInfo').hostname).toEqual(newHostname);
            });

            it('can update a collection object through a custom handler', function() {
                updateSpy.andCallFake(function(reference, payload, Result) {
                    var existing = server.getObject(reference);
                    _.extend(existing, payload);
                    server.updateObjects([existing]);
                    return new Result.OkResult(null);
                });

                server.POST('/api/container/CONTAINER-1', {
                    name: 'updatedName'
                });

                expect(server.getObject('CONTAINER-1').name).toEqual('updatedName');
            });

            it('calls the custom singleton update handler with expected arguments', function() {
                updateSpy.andCallFake(staticMockHandler);
                var newHostname = 'new hostname';

                server.POST('/api/systeminfo', {
                    hostname: newHostname
                });

                expect(updateSpy.mostRecentCall.args[0]).toEqual({
                    type: 'SystemInfo',
                    hostname: newHostname
                });
                expect(_.isFunction(updateSpy.mostRecentCall.args[1])).toEqual(true);
                expect(updateSpy.mostRecentCall.args[2]).toBe(server);
            });

            it('calls the custom collection object update handler with expected arguments', function() {
                updateSpy.andCallFake(objectMockHandler);

                server.POST('/api/container/CONTAINER-1', {
                    name: 'newName'
                });

                expect(updateSpy.mostRecentCall.args[0]).toEqual('CONTAINER-1');
                expect(updateSpy.mostRecentCall.args[1]).toEqual({
                    name: 'newName'
                });
                expect(_.isFunction(updateSpy.mostRecentCall.args[2])).toEqual(true);
                expect(updateSpy.mostRecentCall.args[3]).toBe(server);
            });

            it('returns a Result object when updating a singleton', function() {
                updateSpy.andCallFake(function(payload, Result) {
                    return new Result.OkResult(null);
                });

                var result = server.POST('/api/systeminfo');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: null
                    }
                });
            });

            it('can update a collection object through a custom handler', function() {
                updateSpy.andCallFake(function(reference, payload, Result) {
                    return new Result.OkResult(null);
                });

                var result = server.POST('/api/container/CONTAINER-1');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: null
                    }
                });
            });

            it('ultimately returns a 200/OKResult Result object when singleton handler returns undefined', function() {
                updateSpy.andReturn(undefined);

                var result = server.POST('/api/systeminfo');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: null
                    }
                });
            });

            it('ultimately returns a 200/OKResult Result object when the object handler returns undefined', function() {
                updateSpy.andReturn(undefined);

                var result = server.POST('/api/container/CONTAINER-1');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: null
                    }
                });
            });

            it('wraps result in OKResult if custom singleton update handler does not return a Result', function() {
                updateSpy.andReturn('CreatableType');

                var result = server.POST('/api/systeminfo', {
                    newType: 'testValue'
                });

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: 'CreatableType'
                    }
                });
            });

            it('wraps result in OKResult if custom collection object create handler not return a Result', function() {
                updateSpy.andReturn('REFERENCE-1');

                var result = server.POST('/api/container/CONTAINER-1', {
                    type: 'Container',
                    name: 'testValue'
                });

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: 'REFERENCE-1'
                    }
                });
            });

        });

        describe('delete', function() {

            it('can delete a collection object through a custom handler', function() {
                deleteSpy.andCallFake(function(reference, payload, Result) {
                    server.deleteObjects([reference]);
                    return new Result.OkResult(null);
                });

                server.DELETE('/api/container/CONTAINER-1');

                expect(server.getCollection('Container')).toEqual([]);
            });

            it('calls the custom collection object delete handler with expected arguments', function() {
                deleteSpy.andCallFake(objectMockHandler);

                server.DELETE('/api/container/CONTAINER-23', {
                    name: 'somePayload'
                });

                expect(deleteSpy.mostRecentCall.args[0]).toEqual('CONTAINER-23');
                expect(deleteSpy.mostRecentCall.args[1]).toEqual({
                    name: 'somePayload'
                });
                expect(_.isFunction(deleteSpy.mostRecentCall.args[2])).toEqual(true);
                expect(deleteSpy.mostRecentCall.args[3]).toBe(server);
            });

            it('returns a Result object', function() {
                deleteSpy.andCallFake(function(reference, payload, Result) {
                    return new Result.OkResult({
                        deleteWorked: true
                    });
                });

                var result = server.DELETE('/api/container/CONTAINER-1');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: {
                            deleteWorked: true
                        }
                    }
                });
            });

            it('returns a 200/OKResult Result object if the handler returns undefined', function() {
                deleteSpy.andReturn(undefined);

                var result = server.DELETE('/api/container/CONTAINER-1');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: null
                    }
                });
            });

            it('wraps in OKResult if custom collection object delete handler does not return a Result', function() {
                deleteSpy.andReturn('REFERENCE-1');

                var result = server.DELETE('/api/container/CONTAINER-1');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: 'REFERENCE-1'
                    }
                });
            });

        });

        describe('read', function() {

            it('can return a singleton through custom handler', function() {
                readSpy.andCallFake(function(payload, Result) {
                    return new Result.OkResult({
                        type: 'SystemInfo',
                        productType: 'testRead'
                    });
                });

                var result = server.GET('/api/systeminfo');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: {
                            type: 'SystemInfo',
                            productType: 'testRead'
                        }
                    }
                });
            });

            it('can read a collection object through a custom handler', function() {
                readSpy.andCallFake(function(reference, payload, Result) {
                    return new Result.OkResult({
                        type: 'Container',
                        reference: reference
                    });
                });

                var result = server.GET('/api/container/CONTAINER-999');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: {
                            type: 'Container',
                            reference: 'CONTAINER-999'
                        }
                    }
                });
            });

            it('calls the custom singleton read handler with expected arguments', function() {
                readSpy.andCallFake(staticMockHandler);

                server.GET('/api/systeminfo', {
                    somePayload: true
                });

                expect(readSpy.mostRecentCall.args[0]).toEqual({
                    somePayload: true
                });
                expect(_.isFunction(readSpy.mostRecentCall.args[1])).toEqual(true);
                expect(readSpy.mostRecentCall.args[2]).toBe(server);
            });

            it('calls the custom collection object read handler with expected arguments', function() {
                readSpy.andCallFake(objectMockHandler);

                server.GET('/api/container/CONTAINER-23', {
                    name: 'somePayload'
                });

                expect(readSpy.mostRecentCall.args[0]).toEqual('CONTAINER-23');
                expect(readSpy.mostRecentCall.args[1]).toEqual({
                    name: 'somePayload'
                });
                expect(_.isFunction(readSpy.mostRecentCall.args[2])).toEqual(true);
                expect(readSpy.mostRecentCall.args[3]).toBe(server);
            });

            it('returns a 200/OKResult Result with {} when custom singleton handler returns undefined', function() {
                readSpy.andReturn(undefined);

                var result = server.GET('/api/systeminfo');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: {}
                    }
                });
            });

            it('returns a 200/OKResult Result with {} when custom object handler returns undefined', function() {
                readSpy.andReturn(undefined);

                var result = server.GET('/api/container/CONTAINER-23');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: {}
                    }
                });
            });

            it('wraps in OKResult if custom singleton read handler does not return a Result', function() {
                readSpy.andReturn({ name: 'hi' });

                var result = server.GET('/api/systeminfo');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: { name: 'hi' }
                    }
                });
            });

            it('wraps in OKResult if custom collection object read handler does not return a Result', function() {
                readSpy.andReturn('REFERENCE-1');

                var result = server.GET('/api/container/CONTAINER-1');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: 'REFERENCE-1'
                    }
                });
            });

        });

        describe('list', function() {

            it('ultimately returns what the custom handler returns', function() {
                listSpy.andCallFake(function(payload, Result) {
                    return new Result.ListResult([{
                        type: 'Container',
                        name: 'one',
                        reference: 'CONTAINER-1'
                    }, {
                        type: 'Container',
                        name: 'two',
                        reference: 'CONTAINER-2'
                    }]);
                });

                var result = server.GET('/api/container');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'ListResult',
                        result: [{
                            type: 'Container',
                            name: 'one',
                            reference: 'CONTAINER-1'
                        }, {
                            type: 'Container',
                            name: 'two',
                            reference: 'CONTAINER-2'
                        }]
                    }
                });
            });

            it('calls the custom collection list handler with expected arguments', function() {
                listSpy.andCallFake(staticMockHandler);

                server.GET('/api/container', {queryParam: 'one'});

                expect(listSpy.mostRecentCall.args[0]).toEqual({
                    queryParam: 'one'
                });
                expect(_.isFunction(listSpy.mostRecentCall.args[1])).toEqual(true);
                expect(listSpy.mostRecentCall.args[2]).toBe(server);
            });

            it('ultimately returns a 200/[] Result when custom handler returns undefined', function() {
                listSpy.andReturn(undefined);

                var result = server.GET('/api/container', { queryParam: 'one' });

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'ListResult',
                        result: []
                    }
                });
            });

            it('wraps return in a ListResult if custom collection list handler does not return a Result', function() {
                listSpy.andReturn([]);

                var result = server.GET('/api/container');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'ListResult',
                        result: []
                    }
                });
            });

        });

    });

    describe('custom root operation handlers', function() {
        var doRootSpy;

        beforeEach(function() {
            doRootSpy = jasmine.createSpy('Container.doRootSpy');
            server.addRootOpHandler('Container', 'doRoot', doRootSpy);
        });

        it('ultimately returns the Result returned by the handler', function() {
            doRootSpy.andCallFake(function(payload, Result) {
                return new Result.OkResult({ name : 'rootOperationResult'});
            });

            var result = server.POST('/api/container/doRoot');

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: {
                        name: 'rootOperationResult'
                    }
                }
            });
        });

        it('is called with expected arguments', function() {
            server.POST('/api/container/doRoot', {
                name: 'testName'
            });

            expect(doRootSpy.mostRecentCall.args[0]).toEqual({
                name: 'testName'
            });
            expect(_.isFunction(doRootSpy.mostRecentCall.args[1])).toBe(true);
            expect(doRootSpy.mostRecentCall.args[2]).toBe(server);
        });

        it('is called with expected arguments when called with GET', function() {
            var doRootParamsSpy = jasmine.createSpy('Container.doRootSpy');
            server.addRootOpHandler('Container', 'doRootParams', doRootParamsSpy);
            server.GET('/api/container/doRootParams', { param1: 'foo'});

            expect(doRootParamsSpy.mostRecentCall.args[0]).toEqual({
                param1: 'foo'
            });
            expect(_.isFunction(doRootParamsSpy.mostRecentCall.args[1])).toBe(true);
            expect(doRootParamsSpy.mostRecentCall.args[2]).toBe(server);
        });

        it('it ultimately returns a 200/null Result object if it returns undefined', function() {
            doRootSpy.andReturn(undefined);

            var result = server.POST('/api/container/doRoot');

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: null
                }
            });
        });

        it('ultimately returns a Result when called with GET', function() {
            server.createObjects(STANDARD_CONTAINER);
            server.addRootOpHandler('Container', 'doRootParams', function(parameters, Result) {
                return new Result.OkResult(parameters);
            });

            var result = server.GET('/api/container/doRootParams', {param1: 'foo'});

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: {
                        param1: 'foo'
                    }
                }
            });
        });

        it('wraps a non-Result in an OkResult', function() {
            doRootSpy.andReturn('testString');

            var result = server.POST('/api/container/doRoot');
            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: 'testString'
                }
            });
        });

    });

    describe('custom object operation handlers', function() {
        var doObjSpy;

        beforeEach(function() {
            server.createObjects(STANDARD_CONTAINER);
            doObjSpy = jasmine.createSpy('Container.doObjSpy');
            server.addObjectOpHandler('Container', 'doObj', doObjSpy);
        });

        it('is called with expected arguments', function() {
            server.POST('/api/container/CONTAINER-1/doObj', {
                name: 'testName'
            });

            expect(doObjSpy.mostRecentCall.args[0]).toEqual('CONTAINER-1');
            expect(doObjSpy.mostRecentCall.args[1]).toEqual({
                name: 'testName'
            });
            expect(_.isFunction(doObjSpy.mostRecentCall.args[2])).toBe(true);
            expect(doObjSpy.mostRecentCall.args[3]).toBe(server);
        });

        it('is called with expected parameters arguments', function() {
            var doParamObjSpy = jasmine.createSpy('Container.doParamObjSpy');
            server.addObjectOpHandler('Container', 'doParamOp', doParamObjSpy);

            server.GET('/api/container/CONTAINER-1/doParamOp', { param1: 'foo'});

            expect(doParamObjSpy.mostRecentCall.args[0]).toEqual('CONTAINER-1');
            expect(doParamObjSpy.mostRecentCall.args[1]).toEqual({
                param1: 'foo'
            });
            expect(_.isFunction(doParamObjSpy.mostRecentCall.args[2])).toBe(true);
            expect(doParamObjSpy.mostRecentCall.args[3]).toBe(server);
        });

        it('ultimately returns a 200/OKResult/null Result if it returns undefined', function() {
            doObjSpy.andReturn(undefined);

            var result = server.POST('/api/container/CONTAINER-1/doObj');

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: null
                }
            });
        });

        it('wraps return in OKResult if handler does not return a Result (or undefined)', function() {
            doObjSpy.andReturn({});

            var result = server.POST('/api/container/CONTAINER-1/doObj');

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: {}
                }
            });
        });

        it('ultimately returns a Result when called with GET', function() {
            server.createObjects(STANDARD_CONTAINER);
            server.addObjectOpHandler('Container', 'doParamOp', function(reference, parameters, Result) {
                return new Result.OkResult(parameters);
            });

            var result = server.GET('/api/container/CONTAINER-1/doParamOp', {param1: 'foo'});

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: {
                        param1: 'foo'
                    }
                }
            });
        });

        it('ultimately returns the Result returned by the handler', function() {
            doObjSpy.andCallFake(function(reference, payload, Result) {
                return new Result.OkResult({ name : 'objectOperationResult'});
            });

            var result = server.POST('/api/container/CONTAINER-1/doObj');

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: {
                        name: 'objectOperationResult'
                    }
                }
            });
        });

    });

    describe('Result()', function() {
        var doObjSpy;

        beforeEach(function() {
            server.createObjects(STANDARD_CONTAINER);
            doObjSpy = jasmine.createSpy('Container.doObjSpy');
            server.addObjectOpHandler('Container', 'doObj', doObjSpy);
        });

        it('Result() returns an object of type Result', function() {
            var result;
            doObjSpy.andCallFake(function(reference, payload, Result) {
                result = new Result() instanceof Result;
            });

            server.POST('/api/container/CONTAINER-1/doObj');

            expect(result).toBe(true);
        });

        it('Result() returns an object with the statusCode and data fields', function() {
            var result;
            doObjSpy.andCallFake(function(reference, payload, Result) {
                result = new Result(7734, 'testValue');
            });

            server.POST('/api/container/CONTAINER-1/doObj');

            expect(result).toEqual({
                statusCode: 7734,
                data: 'testValue'
            });
        });

        it('Result() throws an exception if not called with new', function() {
            doObjSpy.andCallFake(function(reference, payload, Result) {
                Result(200, 4);
            });

            expect(function() {
                server.POST('/api/container/CONTAINER-1/doObj');
            }).toDxFail('Must call Result() with new.');
        });

        describe('.ListResult()', function() {

            it('returns an object of type Result', function() {
                var result;
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    result = new Result.ListResult([5]) instanceof Result;
                });

                server.POST('/api/container/CONTAINER-1/doObj');

                expect(result).toBe(true);
            });

            it('returns an object with the defined fields', function() {
                var result;
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    result = new Result.ListResult([5]);
                });

                server.POST('/api/container/CONTAINER-1/doObj');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'ListResult',
                        result: [5]
                    }
                });
            });

            it('throws an exception if not called with an array', function() {
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    new Result.ListResult(200, 4);
                });

                expect(function() {
                    server.POST('/api/container/CONTAINER-1/doObj');
                }).toDxFail('Must call Result.ListResult() with an array.');
            });

            it('throws an exception if not called with new', function() {
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    Result.ListResult([5]);
                });

                expect(function() {
                    server.POST('/api/container/CONTAINER-1/doObj');
                }).toDxFail('Must call Result.ListResult() with new.');
            });

        });

        describe('.OkResult()', function() {

            it('returns an object of type Result', function() {
                var result;
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    result = new Result.OkResult(5) instanceof Result;
                });

                server.POST('/api/container/CONTAINER-1/doObj');

                expect(result).toBe(true);
            });

            it('returns an object with the defined fields', function() {
                var result;
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    result = new Result.OkResult(5);
                });

                server.POST('/api/container/CONTAINER-1/doObj');

                expect(result).toEqual({
                    statusCode: 200,
                    data: {
                        type: 'OKResult',
                        result: 5
                    }
                });
            });

            it('throws an exception if not called with new', function() {
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    Result.OkResult(5);
                });

                expect(function() {
                    server.POST('/api/container/CONTAINER-1/doObj');
                }).toDxFail('Must call Result.OkResult() with new.');
            });

        });

        describe('.ErrorResult()', function() {

            it('returns an object of type Result', function() {
                var result;
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    result = new Result.ErrorResult(5, {}) instanceof Result;
                });

                server.POST('/api/container/CONTAINER-1/doObj');

                expect(result).toBe(true);
            });

            it('returns an object with the defined fields', function() {
                var result;
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    result = new Result.ErrorResult(500, {});
                });

                server.POST('/api/container/CONTAINER-1/doObj');

                expect(result).toEqual({
                    statusCode: 500,
                    data: {
                        type: 'ErrorResult',
                        status: 'ERROR',
                        error: {}
                    }
                });
            });

            it('throws an exception if not called with new', function() {
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    Result.ErrorResult(666, 5);
                });

                expect(function() {
                    server.POST('/api/container/CONTAINER-1/doObj');
                }).toDxFail('Must call Result.ErrorResult() with new.');
            });

        });

        describe('.MissingObjResult()', function() {

            it('returns an object of type Result', function() {
                var result;
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    result = new Result.MissingObjResult('a', 'b', 'c') instanceof Result;
                });

                server.POST('/api/container/CONTAINER-1/doObj');

                expect(result).toBe(true);
            });

            it('returns an object with the defined fields', function() {
                var result;
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    result = new Result.MissingObjResult('a', 'b', 'c');
                });

                server.POST('/api/container/CONTAINER-1/doObj');

                expect(result).toEqual({
                    statusCode: 404,
                    data: {
                        type: 'ErrorResult',
                        status: 'ERROR',
                        error: {
                            type: 'APIError',
                            details: 'a/b could not be found for c.',
                            id: 'object.missing'
                        }
                    }
                });
            });

            it('throws an exception if not called with new', function() {
                doObjSpy.andCallFake(function(reference, payload, Result) {
                    Result.MissingObjResult(666, 5);
                });

                expect(function() {
                    server.POST('/api/container/CONTAINER-1/doObj');
                }).toDxFail('Must call Result.MissingObjResult() with new.');
            });

        });

    });

});

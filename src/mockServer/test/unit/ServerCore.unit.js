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

describe('ServerCore', function() {
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
                }
            },
            '/has-embedded.json': {
                name: 'HasEmbedded',
                extends: {
                    $ref: '/container.json'
                },
                properties: {
                    embedded: {
                        type: 'object',
                        $ref: '/container.json'
                    }
                }
            },
            '/parent-has-embedded.json': {
                name: 'ParentHasEmbedded',
                extends: {
                    $ref: '/has-embedded.json'
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

    describe('construction', function() {

        it('requires schemas when constructed', function() {
            expect(function() {
                new ServerCore();
            }).toDxFail('Must pass a map of schemas when constructing a ServerCore.');
        });

        it('must be called with new', function() {
            expect(function() {
                ServerCore();
            }).toDxFail('Must call ServerCore() with new.');
        });

    });

    describe('createObjects()', function() {

        it('will create objects in the mock server when they are specified with an object', function() {
            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-1'
            }]);

            expect(server.getObject('CONTAINER-1')).not.toBeUndefined();
        });

        it('will create objects in the mock server when they are specified with an array', function() {
            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-2'
            }]);

            expect(server.getObject('CONTAINER-2')).not.toBeUndefined();
        });

        it('will create a singleton in the mock server when it is specified with an object', function() {
            server.createObjects({
                SystemInfo: {
                    type: 'SystemInfo',
                    productType: 'testProduct'
                }
            });

            expect(server.getSingleton('SystemInfo').productType).toBe('testProduct');
        });

        it('will create a singleton in the mock server when it is specified with an array', function() {
            server.createObjects([{
                type: 'SystemInfo',
                productType: 'testProduct'
            }]);

            expect(server.getSingleton('SystemInfo').productType).toBe('testProduct');
        });

        it('will add a type property to the objects if none is specified in the object definition', function() {
            server.createObjects({
                Container: {
                    reference: 'CONTAINER-1'
                }
            });

            expect(server.getObject('CONTAINER-1').type).toBe('Container');
        });

        it('will add a type property to singletons if none is specified in the object definition', function() {
            server.createObjects({
                SystemInfo: {
                    reference: 'SYSTEMINFO-1'
                }
            });

            expect(server.getSingleton('SystemInfo').type).toEqual('SystemInfo');
        });

        it('will add a reference to an object that was not given one in the object definition', function() {
            server.createObjects([{
                type: 'Container'
            }]);

            // We don't look at the content of the reference because it is an opaque value
            expect(_.isString(server.getCollection('Container')[0].reference)).toBe(true);
        });

        it('will return an array with references for objects it creates and undefined for singletons', function() {
            var result = server.createObjects([{
                type: 'Container'
            }, {
                type: 'SystemInfo',
                productType: 'testProduct'
            }, {
                type: 'Container'
            }]);

            /*
             * Note: The structure of a reference is opaque. This test relies on particular values, but even with the
             * mock server, this is not a stable interface
             */
            expect(result).toEqual(['CONTAINER-1000', undefined, 'CONTAINER-1001']);
        });

        it('will not add a reference if creating a type that has no reference property', function() {
            server.createObjects({
                Notification: [{
                    type: 'NotificationDrop'
                }]
            });

            expect(server.getCollection('Notification')[0].reference).toBeUndefined();
        });

        it('replaces undefined in the object definitions with null (the server vends JSON, and JSON has no undefined)',
            function() {
                server.createObjects([{
                    type: 'MiscTypes',
                    reference: 'MISCTYPES-1',
                    nullable: undefined
                }]);

                expect(server.getObject('MISCTYPES-1').nullable).toBe(null);
            });

        it('replaces a date object in the object definitions with a JSON string', function() {
            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                creationTime: new Date('2001-01-01T01:02:03.000Z')
            }]);

            expect(server.getObject('CONTAINER-1').creationTime).toBe('2001-01-01T01:02:03.000Z');
        });

        it('replaces a date objects in embedded objects', function() {
            server.createObjects([{
                type: 'MiscTypes',
                reference: 'MISCTYPES-1',
                time: new Date('2001-01-01T01:02:03.000Z')
            }]);

            expect(server.getObject('MISCTYPES-1').time).toBe('2001-01-01T01:02:03.000Z');
        });

        it('replaces a date objects in embedded arrays', function() {
            server.createObjects([{
                type: 'MiscTypes',
                reference: 'MISC-1',
                anArray: [{
                    timestamp: new Date('2001-01-01T01:02:03.000Z')
                }]
            }]);

            expect(server.getObject('MISC-1').anArray[0].timestamp).toBe('2001-01-01T01:02:03.000Z');
        });

        it('puts objects specified with a subtype in an array into the proper root collection', function() {
            server.createObjects([{
                type: 'SubContainer',
                reference: 'CONTAINER-1',
                name: 'AContainer'
            }]);

            expect(server.getCollection('Container')[0].name).toBe('AContainer');
        });

        it('throws an error if given an object with no type', function() {
            expect(function() {
                server.createObjects([{
                    reference: 'BOGUS-1'
                }]);
            }).toDxFail('No type property found on object.');
        });

        it('throws an error if given an object with an unknown schema type', function() {
            expect(function() {
                server.createObjects([{
                    type: 'BogusCookies',
                    reference: 'BOGUS-1'
                }]);
            }).toDxFail('BogusCookies is not a known schema type.');
        });

        it('throws an error if given an object which is not in a collection', function() {
            expect(function() {
                server.createObjects([{
                    type: 'ParameterType'
                }]);
            }).toDxFail('ParameterType is not a type descended from one with a root property.');
        });

        it('does not affect existing objects', function() {
            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'one'
            }]);
            server.createObjects([{
                type: 'Container',
                name: 'two'
            }]);

            expect(server.getObject('CONTAINER-1').name).toBe('one');
        });

        it('adds new objects', function() {
            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'one'
            }, {
                type: 'Container',
                reference: 'CONTAINER-2',
                name: 'two'
            }]);

            expect(server.getObject('CONTAINER-1').name).toBe('one');
            expect(server.getObject('CONTAINER-2').name).toBe('two');
        });

        it('posts create notifications for objects', function() {
            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'one'
            }]);

            var notifications = server.getCollection('Notification');
            expect(notifications.length).toEqual(1);
            expect(notifications[0]).toEqual({
                type: 'ObjectNotification',
                objectType: 'Container',
                object: 'CONTAINER-1',
                eventType: 'CREATE'
            });
        });

        it('posts create notifications for singleton objects', function() {
            server.createObjects({
                SystemInfo: { productType: 'foo' }
            });
            var notifications = server.getCollection('Notification');
            expect(notifications.length).toEqual(1);
            expect(notifications[0]).toEqual({
                type: 'SingletonUpdate',
                objectType: 'SystemInfo'
            });
        });

        it('posts no creation notification for types with no reference property', function() {
            server.createObjects({
                Referenceless: [{}]
            });
            var notifications = server.getCollection('Notification');
            expect(notifications.length).toEqual(0);
        });

    });

    describe('updateObjects()', function() {

        it('updates objects', function() {
            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'foo'
            }]);

            server.updateObjects([{
                reference: 'CONTAINER-1',
                name: 'bar'
            }]);

            expect(server.getObject('CONTAINER-1').name).toBe('bar');
        });

        it('updates sub-root object types', function() {
            server.createObjects([{
                type: 'ParentHasEmbedded',
                reference: 'CONTAINER-1',
                name: 'foo'
            }]);

            server.updateObjects([{
                reference: 'CONTAINER-1',
                embedded: {
                    name: 'newName'
                }
            }]);

            expect(server.getObject('CONTAINER-1').embedded.name).toBe('newName');
        });

        it('updates objects given the object-form of its argument', function() {
            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'foo'
            }]);

            server.updateObjects({
                Container: [{
                    reference: 'CONTAINER-1',
                    name: 'bar'
                }]
            });

            expect(server.getObject('CONTAINER-1').name).toBe('bar');
        });

        it('updates singleton objects', function() {
            server.createObjects({
                SystemInfo: {
                    productType: 'foo'
                }
            });

            server.updateObjects([{
                type: 'SystemInfo',
                productType: 'bar'
            }]);

            expect(server.getSingleton('SystemInfo').productType).toBe('bar');
        });

        it('updates plain embedded objects', function() {
            server.createObjects({
                MiscTypes: [{
                    reference: 'MISC-1',
                    name: 'foo',
                    properties: {
                        strKey: 'stringValue',
                        boolKey: true,
                        numKey: 45.2,
                        nullKey: null,
                        disappearingKey: 'defined'
                    }
                }]
            });

            server.updateObjects([{
                reference: 'MISC-1',
                properties: {
                    strKey: 'newStringValue',
                    boolKey: false,
                    numKey: 50,
                    nullKey: null,
                    newKey: 'hello'
                }
            }]);

            expect(server.getObject('MISC-1').properties).toEqual({
                strKey: 'newStringValue',
                boolKey: false,
                numKey: 50,
                nullKey: null,
                newKey: 'hello'
            });
        });

        it('updates embedded objects even when they had no value to start', function() {
            server.createObjects({
                HasEmbedded: [{
                    reference: 'HE-1',
                    embedded: undefined
                }]
            });

            server.updateObjects([{
                reference: 'HE-1',
                embedded: {
                    name: 'testName'
                }
            }]);

            expect(server.getObject('HE-1')).toEqual({
                type: 'HasEmbedded',
                reference: 'HE-1',
                embedded: {
                    name: 'testName'
                }
            });
        });

        it('updates using the JSON version of a data object when passed a date object', function() {
            server.createObjects([{
                type: 'MiscTypes',
                reference: 'MISC-1',
                time: new Date('2001-01-01T01:02:03.000Z')
            }]);

            server.updateObjects([{
                reference: 'MISC-1',
                time: new Date('2222-02-02T02:02:02.000Z')
            }]);

            expect(server.getObject('MISC-1').time).toBe('2222-02-02T02:02:02.000Z');
        });

        it('throws an error when it is passed an object with no reference', function() {
            expect(function() {
                server.updateObjects([{
                    time: new Date('2222-02-02T02:02:02.000Z')
                }]);
            }).toDxFail('Can not update an object without at least a reference.');
        });

        it('throws an error if asked to update an object that does not exist', function() {
            expect(function() {
                server.updateObjects([{
                    reference: 'CONTAINER-1',
                    creationTime: new Date('2222-02-02T02:02:02.000Z')
                }]);
            }).toDxFail('There is no object with the reference CONTAINER-1 to update.');
        });

        it('posts object notifications', function() {
            server.createObjects({
                Container: [{ reference: 'CONTAINER-1' }, { reference: 'CONTAINER-2' }],
                MiscTypes: [{ reference: 'MISC-1' }]
            }, true);

            server.updateObjects([{ reference: 'CONTAINER-1' }, { reference: 'MISC-1' }]);

            var notifications = server.getCollection('Notification');
            expect(notifications.length).toEqual(2);
            expect(notifications[0]).toEqual({
                type: 'ObjectNotification',
                objectType: 'Container',
                object: 'CONTAINER-1',
                eventType: 'UPDATE'
            });
            expect(notifications[1]).toEqual({
                type: 'ObjectNotification',
                objectType: 'MiscTypes',
                object: 'MISC-1',
                eventType: 'UPDATE'
            });
        });

        it('posts no object notifications when the skipNotifications argument is set to true', function() {
            server.createObjects({
                Container: [{ reference: 'CONTAINER-1' }, { reference: 'CONTAINER-2' }]
            }, true);

            server.updateObjects([{ reference: 'CONTAINER-1' }], true);

            expect(server.getCollection('Notification').length).toEqual(0);
        });

        it('posts singleton update notifications', function() {
            server.createObjects({
                SystemInfo: { productType: 'foo' }
            }, true);

            server.updateObjects([
                { type: 'SystemInfo' }
            ]);

            expect(server.getCollection('Notification')).toEqual([{
                type: 'SingletonUpdate',
                objectType: 'SystemInfo'
            }]);
        });

        it('posts no singleton update notifications when the skipNotifications is set to true', function() {
            server.createObjects({
                SystemInfo: { productType: 'foo' }
            }, true);

            server.updateObjects([
                { type: 'SystemInfo' }
            ], true);

            expect(server.getCollection('Notification').length).toEqual(0);
        });

    });

    describe('deleteObjects()', function() {

        it('does not affect existing objects', function() {
            server.createObjects({
                Container: [{ reference: 'CONTAINER-1' }, { reference: 'CONTAINER-2' }],
                MiscTypes: [{ reference: 'MISC-1'}]
            });

            server.deleteObjects([ 'CONTAINER-2' ]);

            expect(server.getObject('CONTAINER-1')).not.toBeUndefined();
            expect(server.getObject('MISC-1')).not.toBeUndefined();
        });

        it('deletes a single object', function() {
            server.createObjects({
                Container: [{ reference: 'CONTAINER-1' }]
            });

            server.deleteObjects([ 'CONTAINER-1' ]);

            expect(server.getObject('CONTAINER-1')).toBeUndefined();
        });

        it('deletes multiple objects', function() {
            server.createObjects({
                Container: [{ reference: 'CONTAINER-1' }, { reference: 'CONTAINER-2' }],
                MiscTypes: [{ reference: 'MISC-1' }]
            });

            server.deleteObjects([ 'CONTAINER-1', 'CONTAINER-2', 'MISC-1' ]);
            expect(server.getCollection('Container').length).toBe(0);
            expect(server.getCollection('MiscTypes').length).toBe(0);
        });

        it('throws an error if asked to delete a singleton', function() {
            server.createObjects({
                SystemInfo: { platformType: 'foo' }
            });

            expect(function() {
                server.deleteObjects([ 'SystemInfo' ]);
            }).toDxFail('Can not delete singletons (SystemInfo is a singleton).');

        });

        it('throws an error if asked to delete an object which does not exist', function() {
            expect(function() {
                server.deleteObjects([ 'CONTAINER-1' ]);
            }).toDxFail('Could not find CONTAINER-1 to delete it.');
        });

        it('throws an error if asked to delete an object with no reference', function() {
            expect(function() {
                server.deleteObjects([ { type: 'Container' } ]);
            }).toDxFail('No reference provided to identify the object to delete.');
        });

        it('posts delete notifications', function() {
            server.createObjects({
                Container: [{ reference: 'CONTAINER-1' }, { reference: 'CONTAINER-2' }]
            }, true);

            server.deleteObjects([ 'CONTAINER-1' ]);

            var notifications = server.getCollection('Notification');
            expect(notifications.length).toEqual(1);
            expect(notifications[0]).toEqual({
                type: 'ObjectNotification',
                objectType: 'Container',
                object: 'CONTAINER-1',
                eventType: 'DELETE'
            });
        });

        it('will not post a notification if told not to', function() {
            server.createObjects({
                Container: [{ reference: 'CONTAINER-1' }, { reference: 'CONTAINER-2' }]
            }, true);

            server.deleteObjects([ 'CONTAINER-1' ], true);

            var notifications = server.getCollection('Notification');
            expect(notifications.length).toEqual(0);
        });

    });

    describe('getSingleton()', function() {

        it('throws an error if asked to retrieve a an unknown type', function() {
            expect(function() {
                server.getSingleton('Frog');
            }).toDxFail('Frog is not a singleton type.');
        });

        it('throws an error if asked to retrieve a type which is not a singleton', function() {
            expect(function() {
                server.getSingleton('Other');
            }).toDxFail('Other is not a singleton type.');
        });

        it('returns a singleton object', function() {
            server.createObjects({ SystemInfo: { productType: 'testhost' }});

            expect(server.getSingleton('SystemInfo')).toEqual({
                type: 'SystemInfo',
                productType: 'testhost'
            });
        });

        it('returns a singleton object, even if none was previously set', function() {
            expect(server.getSingleton('SystemInfo')).toEqual({
                type: 'SystemInfo'
            });
        });

        it('returns a copy of the data in the server', function() {
            var result = server.getSingleton('SystemInfo');

            server.updateObjects([{
                type: 'SystemInfo',
                productType: 'whatever'
            }], true);

            expect(result).toEqual({
                type: 'SystemInfo'
            });
        });

    });

    describe('getObject()', function() {
        var container;

        beforeEach(function() {
            container = {
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'one'
            };
            server.createObjects([container], true);
            // Put another type to catch bug (loop looking for obj finds correct, then replaces with wrong value)
            server.createObjects([{
                type: 'MiscTypes',
                reference: 'MISC-1'
            }], true);
        });

        it('can look up a collection object with just a reference', function() {
            expect(server.getObject('CONTAINER-1')).toEqual(container);
        });

        it('can look up an object with a reference and type', function() {
            expect(server.getObject('CONTAINER-1', 'Container')).toEqual(container);
        });

        it('throws an error when asked to look up an object (with a type) that does not exist', function() {
            expect(function() {
                server.getObject('CONTAINER-1', 'Bogus');
            }).toDxFail('Bogus is not a known type.');
        });

        it('returns undefined when asked to look up an object (without a type) that does not exist', function() {
            expect(server.getObject('BOGUS-1')).toBeUndefined();
        });

        it('returns a copy of the provided object', function() {
            expect(server.getObject('CONTAINER-1', 'Container')).not.toBe(container);
        });

        it('returns a copy of the data that will not be updated if the server copy is updated', function() {
            var result = server.getObject('CONTAINER-1');

            server.updateObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'two'
            }], true);

            expect(result.name).toEqual('one');
        });

        it('throws an error if asked to retrieve a non-rooted type', function() {
            expect(function() {
                server.getObject('PARAM-1', 'ParameterType');
            }).toDxFail('Can only ask for objects in collections with a root property with getObject().');
        });

        it('throws an error if asked to retrieve an object with a type other than the root type', function() {
            var subcontainer = {
                type: 'SubContainer',
                reference: 'SUB_CONTAINER-1',
                name: 'subContainer'
            };
            server.createObjects([subcontainer], true);

            expect(function() {
                server.getObject('SUB_CONTAINER-1', 'SubContainer');
            }).toDxFail('Must specify the root type (Container) if a type is specified to getObject().');
        });

        it('will not return a singleton even if somehow there is a name ambiguity (whitebox)', function() {
            server.createObjects({
                SystemInfo: {},
                Container: [{
                    reference: 'SystemInfo'
                }]
            });

            var result = server.getObject('SystemInfo');

            expect(result).toEqual({
                type: 'Container',
                reference: 'SystemInfo'
            });
        });

    });

    describe('getCollection()', function() {
        var containerOne;
        var containerTwo;

        beforeEach(function() {
            containerOne = {
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'one'
            };
            containerTwo = {
                type: 'SubContainer',
                reference: 'CONTAINER-2',
                name: 'two'
            };
            server.createObjects([containerOne, containerTwo], true);
        });

        it('returns all objects', function() {
            expect(server.getCollection('Container')).toEqual([containerOne, containerTwo]);
        });

        it('returns an empty collection if it is a valid type but the server has no objects', function() {
            expect(server.getCollection('MiscTypes')).toEqual([]);
        });

        it('throws an error if asked to retrieve a singleton type', function() {
            expect(function() {
                server.getCollection('SystemInfo');
            }).toDxFail('SystemInfo is a singleton type, not a collection type.');
        });

        it('throws an error if asked to retrieve an unknown type', function() {
            expect(function() {
                server.getCollection('BogusType');
            }).toDxFail('BogusType is not a known type.');
        });

        it('throws an error if asked to retrieve child of a root type', function() {
            expect(function() {
                server.getCollection('SubContainer');
            }).toDxFail('Must specify the root type (Container).');
        });

        it('throws an error if asked to retrieve a non-rooted type', function() {
            expect(function() {
                server.getCollection('ParameterType');
            }).toDxFail('Can only ask for collections with a root property.');
        });

        it('returns a copy of the data that will not be updated if the server copy is updated', function() {
            var result = server.getCollection('Container');

            server.updateObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'updated'
            }], true);

            expect(result[0].name).toEqual('one');
        });

    });

    describe('clearCollection()', function() {
        var containerOne;
        var containerTwo;

        beforeEach(function() {
            containerOne = {
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'one'
            };
            containerTwo = {
                type: 'SubContainer',
                reference: 'CONTAINER-2',
                name: 'two'
            };
            server.createObjects([containerOne, containerTwo], true);
        });

        it('removes all objects ', function() {
            server.clearCollection('Container');

            expect(server.getCollection('Container')).toEqual([]);
        });

        // This stands in for all the type checking, as the implementation sits on getCollection()
        it('throws an error if asked to clear child of a root type', function() {
            expect(function() {
                server.clearCollection('SubContainer');
            }).toDxFail('Must specify the root type (Container).');
        });

    });

    describe('getCollectionLength()', function() {
        var containerOne;
        var containerTwo;

        beforeEach(function() {
            containerOne = {
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'one'
            };
            containerTwo = {
                type: 'SubContainer',
                reference: 'CONTAINER-2',
                name: 'two'
            };
            server.createObjects([containerOne, containerTwo], true);
        });

        it('removes all objects ', function() {
            expect(server.getCollectionLength('Container')).toEqual(2);
        });

        // This stands in for all the type checking, as the implementation sits on getCollection()
        it('throws an error if asked to retrieve child of a root type', function() {
            expect(function() {
                server.getCollectionLength('SubContainer');
            }).toDxFail('Must specify the root type (Container).');
        });

    });

    // NOTE: Mostly this is tested through the various handler routines.  These are just sanity checks
    describe('GET()', function() {

        it('returns a value from a GET routine', function() {
            server.createObjects(STANDARD_CONTAINER);

            var result = server.GET('/api/container/CONTAINER-1');

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: {
                        type: 'Container',
                        reference: 'CONTAINER-1'
                    }
                }
            });
        });

        it('returns a copy of the server data', function() {
            server.createObjects([{
                type: 'Container',
                reference: 'CONTAINER-1',
                name: 'startName'
            }]);

            var result = server.GET('/api/container/CONTAINER-1');

            result.data.result.name = 'MODIFIED DATA';

            expect(server.getObject('CONTAINER-1').name).toEqual('startName');
        });

        it('returns 1000/null Result if trying to GET a POST-able URL', function() {
            server.createObjects(STANDARD_CONTAINER);

            var result = server.GET('/api/container/CONTAINER-1/doObj');

            expect(result).toEqual({
                statusCode: 1000,
                data: null
            });
        });

        it('returns 1000/null Result if trying to GET a non-existent URL', function() {
            var result = server.GET('/nowhere/at/all');

            expect(result).toEqual({
                statusCode: 1000,
                data: null
            });
        });

    });

    describe('POST()', function() {

        it('returns a value from a POST operation', function() {
            server.createObjects(STANDARD_CONTAINER);
            server.addObjectOpHandler('Container', 'doObj', function(reference, payload, Result) {
                return new Result.OkResult('test');
            });

            var result = server.POST('/api/container/CONTAINER-1/doObj');

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: 'test'
                }
            });
        });

        it('returns a copy of the server data', function() {
            var data = {
                name: 'test'
            };
            server.createObjects(STANDARD_CONTAINER);
            server.addObjectOpHandler('Container', 'doObj', function(reference, payload, Result) {
                return new Result.OkResult(data);
            });
            var result = server.POST('/api/container/CONTAINER-1/doObj');

            data.name = 'AlteredName';

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: {
                        name: 'test'
                    }
                }
            });
        });

        it('returns 1000/null Result if trying to POST a GET-able URL', function() {
            server.createObjects(STANDARD_CONTAINER);

            var result = server.POST('/api/container/CONTAINER-1/doParamOp');

            expect(result).toEqual({
                statusCode: 1000,
                data: null
            });
        });

        it('returns 1000/null Result if trying to POST a non-existent URL', function() {
            var result = server.POST('/nowhere/at/all');

            expect(result).toEqual({
                statusCode: 1000,
                data: null
            });
        });

    });

    describe('DELETE()', function() {

        it('returns a value from a DELETE operation', function() {
            server.createObjects(STANDARD_CONTAINER);

            var result = server.DELETE('/api/container/CONTAINER-1');

            expect(result).toEqual({
                statusCode: 200,
                data: {
                    type: 'OKResult',
                    result: null
                }
            });
        });

        it('returns 1000/null Result if trying to DELETE a GET-able URL', function() {
            server.createObjects(STANDARD_CONTAINER);

            var result = server.DELETE('/api/container/CONTAINER-1/doParamOp');

            expect(result).toEqual({
                statusCode: 1000,
                data: null
            });
        });

        it('returns 1000/null Result if trying to POST a non-existent URL', function() {
            var result = server.DELETE('/nowhere/at/all');

            expect(result).toEqual({
                statusCode: 1000,
                data: null
            });
        });

    });

    describe('reset', function() {

        it('will clear all objects in the server', function() {
            server.createObjects(STANDARD_CONTAINER);

            server.reset();

            expect(server.getCollection('Container')).toEqual([]);
        });

    });

});

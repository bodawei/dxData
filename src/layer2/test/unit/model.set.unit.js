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
/*global dx, Backbone, jQuery, _, $ */

'use strict';

var schemaStuff = require('../../../layer1/schema.js');
var initCache = require('../../cache.js');
var generateModelConstructors = require('../../model.js');

describe('generateModelConstructors - set', function() {
    var target;

    describe('set()', function() {
        function buildModelFromSchema(schema) {
            target = {};
            var simpleOther = {
                name: 'SimpleType',
                properties: {
                    type: {
                        type: 'string'
                    },
                    value: {
                        type: 'integer'
                    }
                }
            };
            var another = {
                name: 'AnotherType',
                properties: {
                    type: {
                        type: 'string'
                    },
                    value: {
                        type: 'integer'
                    }
                }
            };
            var anotherChild = {
                name: 'AnotherChildType',
                'extends': {
                    $ref: 'r'
                }
            };
            var schemas = schemaStuff.prepareSchemas({
                t: schema,
                s: simpleOther,
                r: another,
                c: anotherChild
            });
            initCache(target);
            generateModelConstructors(schemas, target);
            return target._newClientModel('t');
        }

        it('accepts a call with no parameters', function() {
            var model = buildModelFromSchema({
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            });

            expect(model.set()).toBe(model);
        });

        it('accepts a call with no parameters, when the underlying type has no properties', function() {
            var model = buildModelFromSchema({
            });

            expect(model.set()).toBe(model);
        });

        it('rejects a call with parameters that are not in the type', function() {
            var model = buildModelFromSchema({
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            });

            expect(function() {
                model.set({
                    notAValidProperty: 'true',
                    anotherBadProperty: 23
                });
            }).toDxFail(new Error('notAValidProperty,anotherBadProperty are not attributes of a model of type t.'));
        });

        it('can be called with a single hash of property/values', function() {
            var model = buildModelFromSchema({
                properties: {
                    stringProp: {
                        type: 'string'
                    }
                }
            });

            model.set({stringProp: 'stringValue'});
            expect(model.get('stringProp')).toEqual('stringValue');
        });

        it('can not be called on a server model', function() {
            buildModelFromSchema({
                properties: {
                    stringProp: {
                        type: 'string'
                    }
                }
            });

            var model = target._newServerModel('t');

            expect(function() {
                model.set({stringProp: 'stringValue'});
            }).toDxFail(new Error('Can not modify a server t instance.'));
        });

        it('accepts setting a string attribute to a string', function() {
            var model = buildModelFromSchema({
                properties: {
                    stringProp: {
                        type: 'string'
                    }
                }
            });

            model.set('stringProp', 'stringValue');
            expect(model.get('stringProp')).toEqual('stringValue');
        });

        it('rejects set a non-string value into a string attribute', function() {
            var model = buildModelFromSchema({
                properties: {
                    stringProp: {
                        type: 'string'
                    }
                }
            });

            expect(function() {
                model.set('stringProp', 34);
            }).toDxFail(new Error('stringProp has to be type string but is integer (34)'));
        });

        it('rejects setting an enum attribute to a value not in the schema', function() {
            var schema = {
                properties: {
                    enumProp: {
                        type: 'integer',
                        'enum': [1, 2, 3]
                    }
                }
            };
            var model = buildModelFromSchema(schema);

            expect(function() {
                model.set('enumProp', 4);
            }).toDxFail(new Error('enumProp is an enum and has to be one of [1,2,3] but is 4'));
        });

        it('accepts setting an enum attribute to a value in the schema', function() {
            var schema = {
                properties: {
                    enumProp: {
                        type: 'string',
                        'enum': ['VALUE1', 'VALUE2', 'VALUE3']
                    }
                }
            };
            var model = buildModelFromSchema(schema);

            model.set('enumProp', 'VALUE2');

            expect(model.get('enumProp')).toBe('VALUE2');
        });

        it('accepts setting a boolean, integer, number, null value on attributes of the same type', function() {
            var model = buildModelFromSchema({
                properties: {
                    boolProp: {
                        type: 'boolean'
                    },
                    numProp: {
                        type: 'number'
                    },
                    intProp: {
                        type: 'integer'
                    },
                    nullProp: {
                        type: 'null'
                    }
                }
            });

            model.set('boolProp', true);
            model.set('numProp', 3.4);
            model.set('intProp', 12);
            model.set('nullProp', null);
            expect(model.get('boolProp')).toEqual(true);
            expect(model.get('numProp')).toEqual(3.4);
            expect(model.get('intProp')).toEqual(12);
            expect(model.get('nullProp')).toEqual(null);

            model.set('numProp', 12);
            expect(model.get('numProp')).toEqual(12);
        });

        it('rejects setting a boolean, integer, number, null properties with invalid values', function() {
            var model = buildModelFromSchema({
                properties: {
                    boolProp: {
                        type: 'boolean'
                    },
                    numProp: {
                        type: 'number'
                    },
                    intProp: {
                        type: 'integer'
                    },
                    nullProp: {
                        type: 'null'
                    }
                }
            });

            expect(function() {
                model.set('boolProp', 1);
            }).toDxFail(new Error('boolProp has to be type boolean but is integer (1)'));

            expect(function() {
                model.set('numProp', '3.4');
            }).toDxFail(new Error('numProp has to be type number but is string ("3.4")'));

            expect(function() {
                model.set('intProp', 3.4);
            }).toDxFail(new Error('intProp has to be type integer but is number (3.4)'));

            expect(function() {
                model.set('nullProp', false);
            }).toDxFail(new Error('nullProp has to be type null but is boolean (false)'));
        });

        it('accepts setting a primitive attribute to null', function() {
            var model = buildModelFromSchema({
                properties: {
                    stringProp: {
                        type: 'string'
                    }
                }
            });

            model.set('stringProp', null);
            expect(model.get('stringProp')).toEqual(null);
        });

        it('accepts setting a primitive attribute to undefined', function() {
            var model = buildModelFromSchema({
                properties: {
                    stringProp: {
                        type: 'string'
                    }
                }
            });

            model.set('stringProp', undefined);
            expect(model.get('stringProp')).toBeUndefined();
        });

        it('accepts setting a date attribute to a date object', function() {
            var model = buildModelFromSchema({
                properties: {
                    dateProp: {
                        type: 'string',
                        format: 'date'
                    }
                }
            });

            var date = new Date(2013, 11, 5, 9, 45, 31, 401);

            model.set('dateProp', date);
            expect(model.get('dateProp')).toEqual(date);
        });

        it('accepts setting a date attribute with a string in date format (converts it to a date)', function() {
            var model = buildModelFromSchema({
                properties: {
                    dateProp: {
                        type: 'string',
                        format: 'date'
                    }
                }
            });

            var date = new Date();
            date.setUTCFullYear(2013);
            date.setUTCMonth(2);
            date.setUTCDate(3);
            date.setUTCHours(12);
            date.setUTCMinutes(13);
            date.setUTCSeconds(14);
            date.setUTCMilliseconds(150);

            model.set('dateProp', '2013-03-03T12:13:14.150Z');
            expect(model.get('dateProp')).toEqual(date);
        });

        it('accepts setting a string attribute with a string in date format (leaves it as a string)', function() {
            var model = buildModelFromSchema({
                properties: {
                    stringProp: {
                        type: 'string'
                    }
                }
            });

            model.set('stringProp', '2013-03-03T12:13:14.150Z');
            expect(model.get('stringProp')).toEqual('2013-03-03T12:13:14.150Z');
        });

        it('accepts setting an attribute with date or other type to a date object', function() {
            var model = buildModelFromSchema({
                properties: {
                    dateProp: {
                        type: ['null', 'string'],
                        format: 'date'
                    }
                }
            });

            var date = new Date(2013, 11, 5, 9, 45, 31, 401);

            model.set('dateProp', date);
            expect(model.get('dateProp')).toEqual(date);
        });

        it('accepts setting an array attribute to an empty array', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array'
                    }
                }
            });

            model.set('arrayProp', []);
            expect(model.get('arrayProp')).toEqual([]);
        });

        it('accepts setting an array attribute (makes a copy of the array)', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array'
                    }
                }
            });

            var source = [ 1, 4.5, true, 'hi', null, undefined, { value: true}];
            model.set('arrayProp', source);
            expect(model.get('arrayProp')).toEqual(source);
            expect(model.get('arrayProp')).not.toBe(source);
        });

        it('accepts setting an array attribute to an array containing an array', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array'
                    }
                }
            });

            model.set('arrayProp', [ [ 34 ] ]);
            expect(model.get('arrayProp')).toEqual([ [ 34 ]]);
        });

        it('accepts setting an array attribute to an array which has an object that contains an array', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array'
                    }
                }
            });

            model.set('arrayProp', [ { subArray: [ true, { test: 'tedious'} ] } ]);
            expect(model.get('arrayProp')).toEqual([ { subArray: [ true, { test: 'tedious'} ] } ]);
        });

        it('accepts setting an array attribute to an array with an embedded model (in JSON format)', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array'
                    }
                }
            });

            model.set('arrayProp', [ { type: 'SimpleType' } ]);
            var setArray = model.get('arrayProp');
            expect(setArray[0] instanceof Backbone.Model).toBe(true);
        });

        it('accepts setting an array attribute to an array of the right type, when schema has a limit', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    }
                }
            });

            model.set('arrayProp', [ 'sample' ]);
            expect(model.get('arrayProp')).toEqual([ 'sample' ]);
        });

        it('accepts setting an array attribute to an array of models (in JSON format)', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array',
                        items: {
                            type: 'object',
                            $ref: 's'
                        }
                    }
                }
            });

            model.set('arrayProp', [ { type: 'SimpleType', value: 23 } ]);
            expect(model.get('arrayProp')[0] instanceof Backbone.Model).toBe(true);
        });

        it('rejects setting an array attribute to an array with an incompatible model type', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array',
                        items: {
                            type: 'object',
                            $ref: 'r'
                        }
                    }
                }
            });

            expect(function() {
                model.set('arrayProp', [ { type: 'SimpleType', value: 23 } ]);
            }).toDxFail(new Error('(array item) has to be type object/AnotherType but is object/SimpleType'));
        });

        it('accepts setting an array attribute to an array with a compatible model type', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array',
                        items: {
                            type: 'object',
                            $ref: 'r'
                        }
                    }
                }
            });

            model.set('arrayProp', [ { type: 'AnotherChildType', value: 99 } ]);

            expect(model.get('arrayProp')[0] instanceof Backbone.Model).toBe(true);
        });

        it('rejects setting an array attribute to an array with incompatible primitive element', function() {
            var model = buildModelFromSchema({
                properties: {
                    arrayProp: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    }
                }
            });

            expect(function() {
                model.set('arrayProp', [ 23 ]);
            }).toDxFail(new Error('(array item) has to be type string but is integer (23)'));
        });

        it('accepts setting an object attribute to an empty object', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object'
                    }
                }
            });

            model.set('objectProp', {});
            expect(model.get('objectProp')).toEqual({});
        });

        it('rejects setting an object attribute to an array', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object'
                    }
                }
            });

            expect(function() {
                model.set('objectProp', []);
            }).toDxFail(new Error('objectProp has to be type object but is array ([])'));
        });

        it('accepts setting an object attribute to an object with various values', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object'
                    }
                }
            });

            var value = {
                stringValue: 'string',
                nullValue: null,
                numValue: 1.0e1,
                intValue: -5,
                boolValue: true
            };

            model.set('objectProp', value);
            expect(model.get('objectProp')).toEqual(value);
            expect(model.get('objectProp')).not.toBe(value);
        });

        it('accepts setting an object attribute to a copy of an an object containing an object', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object'
                    }
                }
            });

            model.set('objectProp', { anObj: { value: true } });
            expect(model.get('objectProp')).toEqual({ anObj: { value: true } });
        });

        it('accepts setting an object attribute to an object which has an array that contains an object', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object'
                    }
                }
            });

            model.set('objectProp', { anArray: [ { value: true } ] });
            expect(model.get('objectProp')).toEqual({ anArray: [ { value: true } ] });
        });

        it('accepts setting an object attribute to an object with an embedded model (in JSON format)', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object',
                        $ref: 's'
                    }
                }
            });

            model.set('objectProp', { type: 'SimpleType', value: 23 });
            var setObj = model.get('objectProp');
            expect(setObj.get('value')).toBe(23);
        });

        it('accepts a subset of the properties on an embedded model', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object',
                        $ref: 's'
                    }
                }
            });

            model.set('objectProp', {
                type: 'SimpleType',
                value: 1138
            });
            var setObj = model.get('objectProp');
            expect(setObj instanceof Backbone.Model).toBe(true);
            expect(setObj.get('value')).toBe(1138);
        });

        it('accepts setting null on an embedded model', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object',
                        $ref: 's'
                    }
                }
            });

            model.set('objectProp', null);
            var setObj = model.get('objectProp');
            expect(setObj.get('value')).toBeUndefined();
        });

        it('clears the properties on an embedded model when it is set to null', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object',
                        $ref: 's'
                    }
                }
            });

            model.set('objectProp', {
                type: 'SimpleType',
                value: 1138
            });
            model.set('objectProp', null);
            var setObj = model.get('objectProp');
            expect(setObj.get('value')).toBeUndefined();
        });

        it('sets an embedded model to unefined when the schema allows it', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: ['object', 'null'],
                        $ref: 's'
                    }
                }
            });
            model.set('objectProp', {
                type: 'SimpleType',
                value: 1138
            });
            model.set('objectProp', null);

            expect(model.get('objectProp')).toBeUndefined();
        });

        it('accepts setting a multi-typed attribute to any of the allowed types', function() {
            var model = buildModelFromSchema({
                properties: {
                    multiProp: {
                        type: ['string', 'null']
                    }
                }
            });

            model.set('multiProp', 'stringValue');
            expect(model.get('multiProp')).toBe('stringValue');

            model.set('multiProp', null);
            expect(model.get('multiProp')).toBeUndefined();
        });

        it('rejects setting a multi-typed attribute to an unsupported type', function() {
            var model = buildModelFromSchema({
                properties: {
                    multiProp: {
                        type: ['string', 'null']
                    }
                }
            });

            expect(function() {
                model.set('multiProp', true);
            }).toDxFail(new Error('multiProp has to be type string,null but is boolean (true)'));
        });

        describe('(type change)', function() {
            var model;

            beforeEach(function() {
                var parent = {
                    root: '/a/root/url',
                    name: 'PType',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        reference: {
                            type: 'string'
                        },
                        value: {
                            type: 'integer'
                        },
                        embedded: {
                            type: 'object',
                            $ref: 'other2'
                        }
                    }
                };
                var child = {
                    name: 'CType',
                    'extends': {
                        $ref: 'p'
                    },
                    properties: {
                        age: {
                            type: 'number'
                        },
                        embedded: {
                            type: 'object',
                            $ref: 'other'
                        }
                    }
                };
                var grandChild = {
                    name: 'GType',
                    'extends': {
                        $ref: 'c'
                    }
                };
                var o1 = {
                    name: 'Other',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        name: {
                            type: 'string'
                        }
                    }
                };
                var o2 = {
                    name: 'Other2',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        name: {
                            type: 'string'
                        }
                    }
                };

                target = {};
                var schemas = schemaStuff.prepareSchemas({
                    p: parent,
                    c: child,
                    g: grandChild,
                    other: o1,
                    other2: o2
                });
                initCache(target);
                generateModelConstructors(schemas, target);
                model = target._newServerModel('PType');
            });

            it('converts a supertype to a subtype', function() {
                model = target._newClientModel('PType');

                model.set({type: 'CType'});

                expect(model.get('type')).toBe('CType');
                expect(model.get('age')).toBeUndefined();
            });

            it('triggers change:attr events when the type attribute changes', function() {
                var changeSpy = jasmine.createSpy('changeSpy');
                model = target._newClientModel('PType');
                model.once('change:type', changeSpy);

                model.set({type: 'CType'});

                expect(changeSpy).toHaveBeenCalledWith(model, 'CType');
            });

            it('triggers change:attr events when other attributes change during type conversion', function() {
                var changeSpy = jasmine.createSpy('changeSpy');
                model = target._newClientModel('PType');
                model.set('value', 23);
                model.once('change:value', changeSpy);

                model.set({type: 'CType'});

                expect(changeSpy).toHaveBeenCalledWith(model, undefined);
            });

            it('triggers change:attr events when the attributes are added', function() {
                var changeSpy = jasmine.createSpy('changeSpy');
                model = target._newClientModel('PType');
                model.once('change:age', changeSpy);

                model.set({type: 'CType'});

                expect(changeSpy).toHaveBeenCalledWith(model, undefined);
            });

            it('triggers change event', function() {
                var changeSpy = jasmine.createSpy('changeSpy');
                model = target._newClientModel('PType');
                model.once('change', changeSpy);

                model.set({type: 'CType'});

                expect(changeSpy).toHaveBeenCalledWith(model);
            });

            it('is rejected if asked to change to an incompatible type', function() {
                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'Other2'
                        }
                    });
                });

                expect(function() {
                    model._dxFetch();
                }).toDxFail(new Error('Tried to change this from PType to Other2.'));
            });

            it('is rejected if trying to set its type to a supertype', function() {
                var model = target._newServerModel('CType');
                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'PType'
                        }
                    });
                });

                expect(function() {
                    model._dxFetch();
                }).toDxFail(new Error('Tried to change this from CType to PType.'));
            });

            it('is allowed if the type hasn\'t been fully fetched yet and this is a server model', function() {
                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'CType',
                            age: 134
                        }
                    });
                });
                model._dxFetch();

                expect(model.get('type')).toEqual('CType');
                expect(model.get('age')).toEqual(134);
                expect(model.get('value')).toBeUndefined();
                expect(model.get('embedded').get('type')).toEqual('Other');
            });

            it('is rejected if the model has been fetched', function() {
                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {type: 'CType', age: 134}
                    });
                });
                model._dxFetch();

                expect(function() {
                    model.set({type: 'CType', age: 9999});
                }).toDxFail(new Error('Can not modify a server CType instance.'));
            });

            it('copies the operations functions over', function() {
                var parent = {
                    root: '/a/root/url',
                    name: 'PType',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        reference: {
                            type: 'string'
                        }
                    }
                };
                var child = {
                    name: 'CType',
                    'extends': {
                        $ref: 'p'
                    },
                    operations: {
                        anOp: {
                            payload: {
                                type: 'string'
                            }
                        }
                    }
                };

                target = {};
                var schemas = schemaStuff.prepareSchemas({
                    p: parent,
                    c: child
                });
                initCache(target);
                generateModelConstructors(schemas, target);
                model = target._newServerModel('PType');
                expect(model.$anOp).toBeUndefined();

                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {type: 'CType', reference: 'CHILD-1'}
                    });
                });
                model._dxFetch();

                expect(model.$anOp).toBeDefined();
            });
        });

        describe('(type change of embedded models)', function() {
            var model;
            var ajaxSpy;

            beforeEach(function() {
                var typedObject = {
                    name: 'Typed',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        reference: {
                            type: 'string'
                        }
                    }
                };
                var parent = {
                    root: '/a/root/url',
                    name: 'PType',
                    extends: {
                        $ref: 'typed'
                    },
                    properties: {
                        embedded: {
                            type: 'object',
                            $ref: 'other'
                        }
                    }
                };
                var o1 = {
                    name: 'Other',
                    extends: {
                        $ref: 'typed'
                    },
                    properties: {
                        name: {
                            type: 'string',
                            default: 'defaultName'
                        }
                    }
                };
                var o2 = {
                    // Having a root on a type which is embedded type is very strange. But make sure it works anyway
                    root: '/api/other',
                    name: 'Other2',
                    extends: {
                        $ref: 'other'
                    },
                    properties: {
                        height: {
                            type: 'integer'
                        }
                    },
                    operations: {
                        doit: {
                            payload: {
                                type: 'object',
                                $ref: 'other'
                            }
                        }
                    },
                    update: {},
                    delete: {}
                };
                var o3 = {
                    name: 'Other3',
                    extends: {
                        $ref: 'other2'
                    },
                    properties: {
                        width: {
                            type: 'integer'
                        }
                    }
                };

                target = {};
                var schemas = schemaStuff.prepareSchemas({
                    typed: typedObject,
                    p: parent,
                    other: o1,
                    other2: o2,
                    other3: o3
                });
                initCache(target);
                generateModelConstructors(schemas, target);
                model = target._newServerModel('PType');
                ajaxSpy = spyOn(jQuery, 'ajax');
            });

            it('changes a super type to a subtype', function() {
                model = target._newClientModel('PType');

                model.set({
                    embedded: {
                        type: 'Other2'
                    }
                });

                expect(model.get('embedded').get('type')).toBe('Other2');
            });

            it('resets properties when changing a super type to a subtype', function() {
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        name: 'startingName'
                    }
                });

                model.set({
                    embedded: {
                        type: 'Other2'
                    }
                });

                expect(model.get('embedded').get('name')).toBe('defaultName');
            });

            it('sets child properties when changing a super type to a subtype', function() {
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        name: 'startingName'
                    }
                });

                model.set({
                    embedded: {
                        type: 'Other2',
                        height: 23
                    }
                });

                expect(model.get('embedded').get('height')).toBe(23);
            });

            it('triggers property changes on properties that are reset when converting to subtype', function() {
                var nameSpy = jasmine.createSpy('nameSpy');
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        name: 'startingName'
                    }
                });
                model.get('embedded').on('change:name', nameSpy);

                model.set({
                    embedded: {
                        type: 'Other2',
                        height: 23
                    }
                });

                expect(nameSpy.callCount).toEqual(1);
                model.get('embedded').off('change:name', nameSpy);
            });

            it('triggers property changes on properties that are set', function() {
                var heightSpy = jasmine.createSpy('heightSpy');
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        name: 'startingName'
                    }
                });
                model.get('embedded').on('change:height', heightSpy);

                model.set({
                    embedded: {
                        type: 'Other2',
                        height: 23
                    }
                });

                expect(heightSpy.callCount).toEqual(1);
                model.get('embedded').off('change:height', heightSpy);
            });

            it('does not trigger a change:attrName when an attribute is changed on type converstion, ' +
                'and then unchanged on set', function() {
                var nameSpy = jasmine.createSpy('nameSpy');
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3',
                        name: 'fred'
                    }
                });
                model.get('embedded').on('change:name', nameSpy);

                model.set({
                    embedded: {
                        type: 'Other',
                        name: 'fred'
                    }
                });

                expect(nameSpy).not.toHaveBeenCalled();
                model.get('embedded').off('change:name', nameSpy);
            });

            it('triggers a change:attrName when an attribute is changed on type converstion, ' +
                'and then unchanged on set', function() {
                var nameSpy = jasmine.createSpy('nameSpy');
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3',
                        name: 'fred'
                    }
                });
                model.get('embedded').on('change:name', nameSpy);

                model.set({
                    embedded: {
                        type: 'Other'
                    }
                });

                expect(nameSpy).toHaveBeenCalled();
                model.get('embedded').off('change:name', nameSpy);
            });

            it('adds operations when converting to a subtype', function() {
                model = target._newClientModel('PType');

                model.set({
                    embedded: {
                        type: 'Other2',
                        reference: 'OTHER-2'
                    }
                });

                model.get('embedded').$doit(model.get('embedded'));

                expect(ajaxSpy.mostRecentCall.args[0].url).toEqual('/api/other/OTHER-2/doit');
                expect(ajaxSpy.mostRecentCall.args[0].data).toEqual('{"name":"defaultName","type":"Other2",' +
                    '"reference":"OTHER-2"}');
            });

            it('adds update operation when converting to a subtype', function() {
                model = target._newClientModel('PType');

                model.set({
                    embedded: {
                        type: 'Other2',
                        reference: 'OTHER-2'
                    }
                });

                model.get('embedded').$$update({
                    name: 'fred'
                });

                expect(ajaxSpy.mostRecentCall.args[0].type).toEqual('POST');
                expect(ajaxSpy.mostRecentCall.args[0].url).toEqual('/api/other/OTHER-2');
            });

            it('adds delete operation when converting to a subtype', function() {
                model = target._newClientModel('PType');

                model.set({
                    embedded: {
                        type: 'Other2',
                        reference: 'OTHER-2'
                    }
                });

                model.get('embedded').$$delete();

                expect(ajaxSpy.mostRecentCall.args[0].type).toEqual('DELETE');
                expect(ajaxSpy.mostRecentCall.args[0].url).toEqual('/api/other/OTHER-2');
            });

            it('changes a subtype to a supertype', function() {
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3'
                    }
                });

                model.set({
                    embedded: {
                        type: 'Other'
                    }
                });

                expect(model.get('embedded').get('type')).toBe('Other');
            });

            it('resets attributes when changing a subtype to a supertype', function() {
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3',
                        name: 'startingName'
                    }
                });

                model.set({
                    embedded: {
                        type: 'Other'
                    }
                });

                expect(model.get('embedded').get('name')).toBe('defaultName');
            });

            it('triggers property changes on attributes that are reset', function() {
                var nameSpy = jasmine.createSpy('nameSpy');
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3',
                        name: 'startingName'
                    }
                });
                model.get('embedded').on('change:name', nameSpy);

                model.set({
                    embedded: {
                        type: 'Other'
                    }
                });

                expect(nameSpy.callCount).toEqual(1);
                model.get('embedded').off('change:name', nameSpy);
            });

            it('removes subtype attributes when changing a subtype to a supertype', function() {
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3',
                        width: 45
                    }
                });

                model.set({
                    embedded: {
                        type: 'Other'
                    }
                });

                expect(function() {
                    model.get('embedded').get('width');
                }).toDxFail('width is not a known attribute.');
            });

            it('triggers property changes on attributes that are removed', function() {
                var widthSpy = jasmine.createSpy('nameSpy');
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3',
                        width: 45
                    }
                });
                model.get('embedded').on('change:width', widthSpy);

                model.set({
                    embedded: {
                        type: 'Other'
                    }
                });

                expect(widthSpy.callCount).toEqual(1);
                model.get('embedded').off('change:width', widthSpy);
            });

            it('sets child attributes when changing a supertype to a subtype', function() {
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3'
                    }
                });

                model.set({
                    embedded: {
                        type: 'Other',
                        name: 'setName'
                    }
                });

                expect(model.get('embedded').get('name')).toBe('setName');
            });

            it('triggers property changes on attributes that are set', function() {
                var nameSpy = jasmine.createSpy('nameSpy');
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3'
                    }
                });
                model.get('embedded').on('change:name', nameSpy);

                model.set({
                    embedded: {
                        type: 'Other',
                        name: 'setName'
                    }
                });

                expect(nameSpy.callCount).toEqual(1);
                model.get('embedded').off('change:name', nameSpy);
            });

            it('removes operations when converting to a supertype that does not have them', function() {
                model = target._newClientModel('PType');
                model.set({
                    embedded: {
                        type: 'Other3'
                    }
                });

                model.set({
                    embedded: {
                        type: 'Other'
                    }
                });

                expect(function() {
                    model.get('embedded').$doit(model.get('embedded'));
                }).toDxFail('This operation does not exist on this instance. (it has been converted from a type ' +
                    'that had it).');
            });

        });

        describe('with backbone models', function() {
            var model;

            beforeEach(function() {
                var containing = {
                    root: '/a/root/url',
                    name: 'ContainingType',
                    properties: {
                        type: { type: 'string' },
                        reference: { type: 'string' },
                        value: { type: 'integer' },
                        list: { type: 'array' },
                        keyValues: { type: 'object' },
                        embedded: {
                            type: 'object',
                            $ref: 'emb'
                        }
                    }
                };
                var containingSub = {
                    name: 'ContainingSubType',
                    'extends': {
                        $ref: 'c'
                    },
                    properties: {
                        weight: { type: 'integer' }
                    }
                };
                var embedded = {
                    root: '/a/some/other',
                    name: 'EmbeddedType',
                    properties: {
                        type: { type: 'string' },
                        reference: { type: 'string' },
                        name: { type: 'string' }
                    }
                };
                var embeddedSub = {
                    name: 'EmbeddedSubType',
                    'extends': {
                        $ref: 'emb'
                    },
                    properties: {
                        favorite: { type: 'string' }
                    }
                };

                target = {};
                var schemas = schemaStuff.prepareSchemas({
                    c: containing,
                    cs: containingSub,
                    emb: embedded,
                    emb2: embeddedSub
                });
                initCache(target);
                generateModelConstructors(schemas, target);
            });

            it('can change the type of a client model on set', function() {
                model = target._newClientModel('ContainingType');
                var containingSub = target._newClientModel('ContainingSubType');
                containingSub.set('weight', 45);

                model.set(containingSub);

                expect(model.get('weight')).toBe(45);
            });

            it('can set an embedded object on a client model with another client model', function() {
                model = target._newClientModel('ContainingType');
                var embedded = target._newClientModel('EmbeddedType');
                embedded.set('name', 'embeddedTest');

                model.set('embedded', embedded);

                expect(model.get('embedded').get('name')).toBe('embeddedTest');
            });

            it('can set an embedded object on a client model with a subtype', function() {
                model = target._newClientModel('ContainingType');
                var embedded = target._newClientModel('EmbeddedSubType');
                embedded.set('favorite', 'chocolate');

                model.set('embedded', embedded);

                expect(model.get('embedded').get('type')).toBe('EmbeddedSubType');
                expect(model.get('embedded').get('favorite')).toBe('chocolate');
            });

            it('can set an element of an array with a backbone model (which will be copied)', function() {
                model = target._newClientModel('ContainingType');
                var other = target._newClientModel('EmbeddedType');
                other.set('name', 'arrayElement');
                model.set('list', [other]);

                expect(model.get('list')[0] instanceof Backbone.Model).toBe(true);
                expect(model.get('list')[0].get('name')).toBe('arrayElement');
                expect(model.get('list')[0]).not.toBe(other);
            });

            it('can set an object with a backbone model (which will be copied)', function() {
                model = target._newClientModel('ContainingType');
                var other = target._newClientModel('EmbeddedType');
                other.set('name', 'objectValue');
                model.set('keyValues', { key: other });

                expect(model.get('keyValues').key instanceof Backbone.Model).toBe(true);
                expect(model.get('keyValues').key.get('name')).toBe('objectValue');
                expect(model.get('keyValues').key).not.toBe(other);
            });
        });
    });

});

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
/*global dx, Backbone, jQuery, _, $ */

'use strict';

describe('dx.core.data.generateModelConstructors', function() {
    var target = {};

    var allTypes = {
        name: 'AllTypes',
        properties: {
            type: {
                type: 'string'
            },
            strDef: {
                type: 'string',
                'default': 'IAmDefault'
            },
            nullDef: {
                type: 'null',
                'default': null
            },
            boolDef: {
                type: 'boolean',
                'default': true
            },
            intDef: {
                type: 'integer',
                'default': 45
            },
            numDef: {
                type: 'number',
                'default': 84.5
            },
            strNoDef: {
                type: 'string'
            },
            nullNoDef: {
                type: 'null'
            },
            boolNoDef: {
                type: 'boolean'
            },
            intNoDef: {
                type: 'integer'
            },
            numNoDef: {
                type: 'number'
            },
            dateNoDef: {
                type: 'string',
                format: 'date'
            },
            objectNoDef: {
                type: 'object'
            },
            arrayNoDef: {
                type: 'array'
            },
            embedded: {
                type: 'object',
                $ref: 'simpleEmbeddedType'
            }
        }
    };

    var simpleEmbeddedType = {
        name: 'EmbeddedType',
        properties: {
            strDef: {
                type: 'string',
                'default': 'EmbeddedDefault'
            }
        }
    };

    var simpleReferenceType = {
        name: 'ReferenceType',
        root: '/someRoot',
        properties: {
            type: {
                type: 'string'
            },
            reference: {
                type: 'string'
            },
            sibling: {
                type: 'string',
                format: 'objectReference',
                referenceTo: 'referenceType'
            }
        }
    };

    describe('constructor', function() {
        it('is created for a type defined in the schema ', function() {
            var type = {
                name: 'aType'
            };

            var schemas = dx.core.data._prepareSchemas({t: type});
            dx.core.data._generateModelConstructors(schemas, target);

            expect(target._modelConstructors.aType).toBeDefined();
        });
    });

    describe('idAttribute', function() {
        beforeEach(function() {
            var type = {
                name: 'TestType',
                properties: {
                    reference: {
                        type: 'string'
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({t: type});
            dx.core.data._generateModelConstructors(schemas, target);
        });

        it('is set to "reference"', function() {
            expect(target._modelConstructors.TestType.prototype.idAttribute).toBe('reference');
        });

        it('causes id to be set to the value of the reference attribute of a model', function() {
            var model = target._newClientModel('TestType');
            model.set('reference', 'REFERENCE-1');

            expect(model.id).toBe('REFERENCE-1');
        });

        it('causes id to be set to undefined if the reference has no value', function() {
            var model = target._newClientModel('TestType');

            expect(model.id).toBeUndefined();
        });
    });

    describe('_newServerModel()', function() {
        var model;
        beforeEach(function() {
            target = {};
            var schema = {
                name: 'TypeWithReference',
                properties: {
                    type: {
                        type: 'string'
                    },
                    value: {
                        type: 'string'
                    },
                    other: {
                        type: 'object',
                        $ref: 's'
                    }
                }
            };
            var schema2 = {
                name: 'OtherType',
                properties: {
                    type: {
                        type: 'string'
                    },
                    value: {
                        type: 'string'
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({t: schema, s: schema2});
            dx.core.data._generateModelConstructors(schemas, target);
        });

        it('can create a new server model', function() {
            model = target._newServerModel('TypeWithReference');

            expect(model).toBeDefined();
        });

        it('creates a is server model', function() {
            model = target._newServerModel('TypeWithReference');

            expect(function() {
                model.set('value', 'foo');
            }).toDxFail(new Error('Can not modify a server TypeWithReference instance.'));
        });

        it('creates a model with embedded server models', function() {
            model = target._newServerModel('TypeWithReference');

            expect(function() {
                model.get('other').set('value', 'foo');
            }).toDxFail(new Error('Can not modify a server OtherType instance.'));
        });

        it('will throw an error if asked to create an unknown type', function() {
            expect(function() {
                target._newServerModel('frog');
            }).toDxFail(new Error('frog is not a known type name. Can not create one.'));
        });

        it('will throw an error if asked to create without a type', function() {
            expect(function() {
                target._newServerModel();
            }).toDxFail(new Error('To create a new model, a type name must be provided.'));
        });
    });

    describe('_newClientModel()', function() {
        var model;
        beforeEach(function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType,
                referenceType: simpleReferenceType
            });
            dx.core.data._generateModelConstructors(schemas, target);

            model = target._newClientModel('AllTypes');
        });

        it('can create a new client model', function() {
            expect(model).toBeDefined();
        });

        it('creates a is read-write model', function() {
            model.set('strDef', 'foo');

            expect(model.get('strDef')).toBe('foo');
        });

        it('creates a model with read-write embedded models', function() {
            model.get('embedded').set('strDef', 'foo');

            expect(model.get('embedded').get('strDef')).toBe('foo');
        });

        it('will throw an error if asked to create an unknown type', function() {
            expect(function() {
                target._newClientModel('frog');
            }).toDxFail(new Error('frog is not a known type name. Can not create one.'));
        });

        it('will throw an error if asked to create without a type', function() {
            expect(function() {
                target._newClientModel();
            }).toDxFail(new Error('To create a new model, a type name must be provided.'));
        });

        it('sets the specified default values for simple types (null, string, boolean, integer, number)', function() {
           expect(model.get('strDef')).toEqual('IAmDefault');
           expect(model.get('nullDef')).toEqual(null);
           expect(model.get('boolDef')).toEqual(true);
           expect(model.get('intDef')).toEqual(45);
           expect(model.get('numDef')).toEqual(84.5);
        });

        it('sets the generic default values for simple types (null, string, boolean, integer, number)', function() {
           expect(model.get('strNoDef')).toBeUndefined();
           expect(model.get('nullNoDef')).toBeUndefined();
           expect(model.get('boolNoDef')).toBeUndefined();
           expect(model.get('intNoDef')).toBeUndefined();
           expect(model.get('numNoDef')).toBeUndefined();
        });

        it('sets the generic default values for arrays', function() {
           expect(model.get('arrayNoDef')).toBeUndefined();
        });

        it('sets the generic default values for objects', function() {
           expect(model.get('objectNoDef')).toBeUndefined();
        });

        it('sets the default value for an embedded object to be an actual backbone model', function() {
           expect(model.get('embedded') instanceof Backbone.Model).toBe(true);
           expect(model.get('embedded').get('strDef')).toBe('EmbeddedDefault');
        });
    });

    describe('get()', function() {
        var model;
        beforeEach(function() {
            target = {};
            var schema = {
                name: 'TypeWithReference',
                root: '/somewhere',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    },
                    sibling: {
                        type: 'string',
                        format: 'objectReference',
                        referenceTo: 't'
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({t: schema});
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);

            model = target._newClientModel('TypeWithReference');
        });

        it('throws an error if called without a parameter', function() {
            expect(function() {
                model.get();
            }).toDxFail(new Error('Must provide an attribute name.'));
        });

        it('throws an error if called without a string parameter', function() {
            expect(function() {
                model.get(23);
            }).toDxFail(new Error('Must provide an attribute name.'));
        });

        it('throws an error if try to retrieve unknown attribute', function() {
            expect(function() {
                model.get('badAttribute');
            }).toDxFail(new Error('badAttribute is not a known attribute.'));
        });

        it('retrieves basic values', function() {
            expect(model.get('type')).toBe('TypeWithReference');
        });

        it('retrieves basic values even for server models', function() {
            model = target._newServerModel('TypeWithReference');

            expect(model.get('type')).toBe('TypeWithReference');
        });

        it('can retrieve the related object\'s reference', function() {
            model.set('sibling', 'SIBLING-1');

            expect(model.get('sibling')).toBe('SIBLING-1');
        });

        it('can retrieve the model named by an objectReference attribute value ($attribute)', function() {
            model = target._newClientModel('TypeWithReference');
            var ajaxSpy = spyOn(jQuery, 'ajax');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult',
                    result: {
                        type: 'TypeWithReference',
                        reference: 'SIBLING-1'
                    }
                });
            });
            model.set('sibling', 'SIBLING-1');

            expect(model.get('$sibling') instanceof Backbone.Model).toBe(true);
        });

        it('can retrieve the model named by an objectReference attribute value, even if the type includes null',
            function() {
            target = {};
            var schema = {
                name: 'TypeWithReference',
                root: '/somewhere',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    },
                    sibling: {
                        type: ['string', 'null'],
                        format: 'objectReference',
                        referenceTo: 't'
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({t: schema});
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('TypeWithReference');
            model.set('sibling', 'SIBLING-1');

            var ajaxSpy = spyOn(jQuery, 'ajax');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult',
                    result: {
                        type: 'TypeWithReference',
                        reference: 'SIBLING-1'
                    }
                });
            });
            model.set('sibling', 'SIBLING-1');

            expect(model.get('$sibling') instanceof Backbone.Model).toBe(true);
        });

        it('will throw an error if trying to retrieve a non-object reference value with $ notation', function() {
            target = {};
            var schema = {
                name: 'TypeWithReference',
                root: '/somewhere',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    },
                    sibling: {
                        type: ['string', 'number'],
                        format: 'objectReference',
                        referenceTo: 't'
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({t: schema});
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('TypeWithReference');
            model.set('sibling', 'SIBLING-1');

            model.set('sibling', 23);

            expect(function() {
                model.get('$sibling');
            }).toDxFail('Tried to retrieve a related object with $sibling but value was 23.');
        });

        it('will return undefined if there is no reference value for an objectReference attribute', function() {
            expect(model.get('$sibling')).toBeUndefined();
        });
    });

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
            var schemas = dx.core.data._prepareSchemas({
                t: schema,
                s: simpleOther,
                r: another,
                c: anotherChild
            });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
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

            model.set('objectProp', { value: 1138 });
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

        it('clear\'s the properties on an embedded model when it is set to null', function() {
            var model = buildModelFromSchema({
                properties: {
                    objectProp: {
                        type: 'object',
                        $ref: 's'
                    }
                }
            });

            model.set('objectProp', { value: 1138 });
            model.set('objectProp', null);
            var setObj = model.get('objectProp');
            expect(setObj.get('value')).toBeUndefined();
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
                        }
                    }
                };
                var o2 = {
                    name: 'Other2',
                    properties: {
                        type: {
                            type: 'string'
                        }
                    }
                };

                target = {};
                var schemas = dx.core.data._prepareSchemas({
                    p: parent,
                    c: child,
                    g: grandChild,
                    other: o1,
                    other2: o2
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('PType');
            });

            it('converts a supertype to a subtype', function() {
                model = target._newClientModel('PType');

                model.set({'type': 'CType'});

                expect(model.get('type')).toBe('CType');
                expect(model.get('age')).toBeUndefined();
            });

            it('triggers change:attr events when the type attribute changes', function() {
                var changeSpy = jasmine.createSpy('changeSpy');
                model = target._newClientModel('PType');
                model.once('change:type', changeSpy);

                model.set({'type': 'CType'});

                expect(changeSpy).toHaveBeenCalledWith(model, 'CType');
            });

            it('triggers change:attr events when other attributes change during type conversion', function() {
                var changeSpy = jasmine.createSpy('changeSpy');
                model = target._newClientModel('PType');
                model.set('value', 23);
                model.once('change:value', changeSpy);

                model.set({'type': 'CType'});

                expect(changeSpy).toHaveBeenCalledWith(model, undefined);
            });

            it('triggers change:attr events when the attributes are added', function() {
                var changeSpy = jasmine.createSpy('changeSpy');
                model = target._newClientModel('PType');
                model.once('change:age', changeSpy);

                model.set({'type': 'CType'});

                expect(changeSpy).toHaveBeenCalledWith(model, undefined);
            });

            it('triggers change event', function() {
                var changeSpy = jasmine.createSpy('changeSpy');
                model = target._newClientModel('PType');
                model.once('change', changeSpy);

                model.set({'type': 'CType'});

                expect(changeSpy).toHaveBeenCalledWith(model);
            });

            it('is rejected if asked to change to an incompatible type', function() {
                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            'type': 'Other2'
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
                            'type': 'PType'
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
                            'type': 'CType',
                            'age': 134
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
                    model.set({'type': 'CType', 'age': 9999});
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
                var schemas = dx.core.data._prepareSchemas({
                    p: parent,
                    c: child
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('PType');
                expect(model.$anOp).toBeUndefined();

                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {'type': 'CType', reference: 'CHILD-1'}
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
                var schemas = dx.core.data._prepareSchemas({
                    typed: typedObject,
                    p: parent,
                    other: o1,
                    other2: o2,
                    other3: o3
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
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
                var schemas = dx.core.data._prepareSchemas({
                    c: containing,
                    cs: containingSub,
                    emb: embedded,
                    emb2: embeddedSub
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
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

    // Test Backbone's own escape() behavior, just so we notice if something changes.
    describe('escape()', function() {
        var model;
        beforeEach(function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType,
                referenceType: simpleReferenceType
            });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);

            model = target._newClientModel('AllTypes');
        });

        it('throws an error if try to retrieve unknown attribute', function() {
            expect(function() {
                model.escape('badAttribute');
            }).toDxFail(new Error('badAttribute is not a known attribute.'));
        });

        it('escapes plain values', function() {
            model.set('strDef', '<p>');

            expect(model.escape('strDef')).toEqual('&lt;p&gt;');
        });

        it('escapes plain values', function() {
            model.set('intDef', 23);

            expect(model.escape('intDef')).toEqual('23');
        });

        it('does stupid things with attributes that are objects (this is Backbone\'s behavior, not ours)', function() {
            model.set('objectNoDef', { name: '<p>'});

            expect(model.escape('objectNoDef')).toEqual('[object Object]');
        });

        it('does stupid things with attributes that are arrays (this is Backbone\'s behavior, not ours)', function() {
            model.set('arrayNoDef', [ 'hi', 'bye' ]);

            expect(model.escape('arrayNoDef')).toEqual('hi,bye');
        });

        it('does stupid things with attributes that are models (this is Backbone\'s behavior, not ours)', function() {
            expect(model.escape('embedded')).toEqual('[object Object]');
        });

        it('escapes basic values even for server models', function() {
            model = target._newServerModel('AllTypes');

            expect(model.escape('type')).toBe('AllTypes');
        });

        it('escapes references models', function() {
            var ajaxSpy = spyOn(jQuery, 'ajax');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult',
                    result: {
                        type: 'ReferenceType',
                        reference: 'SIBLING-1'
                    }
                });
            });
            model = target._newClientModel('ReferenceType');
            model.set('sibling', 'SIBLING-1');

            expect(model.escape('$sibling')).toEqual('[object Object]');
        });
    });

    describe('has()', function() {
        var model;
        beforeEach(function() {
            target = {};
            var schema = {
                name: 'TypeWithReference',
                properties: {
                    type: {
                        type: 'string'
                    },
                    sibling: {
                        type: 'string',
                        format: 'objectReference',
                        referenceTo: 't'
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({t: schema});
            dx.core.data._generateModelConstructors(schemas, target);

            model = target._newClientModel('TypeWithReference');
        });

        it('throws an error if called without a parameter', function() {
            expect(function() {
                model.has();
            }).toDxFail(new Error('Must provide an attribute name.'));
        });

        it('throws an error if called without a string parameter', function() {
            expect(function() {
                model.has(23);
            }).toDxFail(new Error('Must provide an attribute name.'));
        });

        it('returns false for an unknown attribute', function() {
            expect(model.has('badAttribute')).toBe(false);
        });

        it('reports if basic attributes have a value', function() {
            expect(model.has('type')).toBe(true);
            expect(model.has('sibling')).toBe(false);
        });

        it('reports if basic attributes have a value even for server models', function() {
            model = target._newServerModel('TypeWithReference');

            expect(model.has('type')).toBe(true);
            expect(model.has('sibling')).toBe(false);
        });

        it('reports correctly for objectReference attributes', function() {
            expect(model.has('sibling')).toBe(false);

            model.set('sibling', 'SIBLING-1');

            expect(model.has('sibling')).toBe(true);
        });

        it('reports correctly for objectReference attributes addressed by $attribute', function() {
            expect(model.has('$sibling')).toBe(false);

            model.set('sibling', 'SIBLING-1');

            expect(model.has('$sibling')).toBe(true);
        });
    });

    describe('unset()', function() {
        var model;
        beforeEach(function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType,
                referenceType: simpleReferenceType
            });
            dx.core.data._generateModelConstructors(schemas, target);

            model = target._newClientModel('AllTypes');
        });

        it('throws an error if try to unset an undefined attribute', function() {
            expect(function() {
                model.unset('bogusAttribute');
            }).toDxFail(new Error('bogusAttribute is not a known attribute.'));
        });

        it('throws an error if no parameter is passed', function() {
            expect(function() {
                model.unset();
            }).toDxFail(new Error('Must provide an attribute name.'));
        });

        it('sets data types with default values to their defaults', function() {
            model.set('strDef', 'NewString');
            model.set('nullDef', null);
            model.set('boolDef', false);
            model.set('intDef', 20131004);
            model.set('numDef', 2013.1);

            model.unset('strDef');
            expect(model.get('strDef')).toBe('IAmDefault');

            model.unset('nullDef');
            expect(model.get('nullDef')).toBeUndefined();

            model.unset('boolDef');
            expect(model.get('boolDef')).toBe(true);

            model.unset('intDef');
            expect(model.get('intDef')).toBe(45);

            model.unset('numDef');
            expect(model.get('numDef')).toBe(84.5);
        });

        it('sets data types with without defaults to standard defaults', function() {
            model.set('strNoDef', 'NewString');
            model.set('nullNoDef', null);
            model.set('boolNoDef', false);
            model.set('intNoDef', 20131004);
            model.set('numNoDef', 2013.1);
            model.set('arrayNoDef', [2013, 10, 4]);
            model.set('objectNoDef', {year: 2013, month: 10, day: 4});

            model.unset('strNoDef');
            expect(model.get('strNoDef')).toBeUndefined();

            model.unset('nullNoDef');
            expect(model.get('nullNoDef')).toBeUndefined();

            model.unset('boolNoDef');
            expect(model.get('boolNoDef')).toBeUndefined();

            model.unset('intNoDef');
            expect(model.get('intNoDef')).toBeUndefined();

            model.unset('numNoDef');
            expect(model.get('numNoDef')).toBeUndefined();

            model.unset('arrayNoDef');
            expect(model.get('arrayNoDef')).toBeUndefined();

            model.unset('objectNoDef');
            expect(model.get('objectNoDef')).toBeUndefined();
        });

        it('clears an embedded type, but does not replace it', function() {
            var embedded = model.get('embedded');
            embedded.set('strDef', 'This is a different value');

            model.unset('embedded');
            expect(model.get('embedded')).toBe(embedded);
            expect(model.get('embedded').get('strDef')).toBe('EmbeddedDefault');
        });

        it('sets changed attributes just like Backbone\'s unset()', function() {
            model.set('intDef', 12);
            model.set('strDef', 'Initial');
            expect(model.changedAttributes()).toEqual({strDef: 'Initial'});
            model.unset('strDef');
            model.unset('embedded');
            expect(model.changedAttributes()).toEqual({strDef: 'IAmDefault'});

            // Test what backbone does, just to make sure we're in line with whatever version we are using
            var PlainModel = Backbone.Model.extend();
            var plainModel = new PlainModel();
            plainModel.set('a', '1');
            plainModel.set('b', '2');
            expect(plainModel.changedAttributes()).toEqual({b: '2'});
            plainModel.unset('a');
            expect(plainModel.changedAttributes()).toEqual({a: undefined});
        });

        it('does not register embedded objects as changedAttributes()', function() {
            model.set('embedded', {strDef: 'newValue'});
            model.set('strDef', 'Fun');
            expect(model.changedAttributes()).toEqual({strDef: 'Fun'});
            model.unset('embedded');
            expect(model.changedAttributes()).toEqual({strDef: 'Fun'});
        });

        it('triggers events just like Backbone\'s unset()', function() {
            var eventListener = jasmine.createSpy('eventListener');
            model.set('strDef', 'Fun');
            model.on('change:strDef', eventListener);
            model.unset('strDef');
            expect(eventListener).toHaveBeenCalled();

            // Test what backbone does, just to make sure we're in line with whatever version we are using
            var bbEventListener = jasmine.createSpy('bbEventListener');
            var PlainModel = Backbone.Model.extend();
            var plainModel = new PlainModel();
            plainModel.set('a', 'oops');
            plainModel.on('change:a', bbEventListener);
            plainModel.unset('a');
            expect(bbEventListener).toHaveBeenCalled();
        });

        it('does not trigger events when silent:true is passed just like Backbone\'s unset()', function() {
            var eventListener = jasmine.createSpy('eventListener');
            model.on('change:strDef', eventListener);
            model.unset('strDef', {silent: true});
            expect(eventListener).not.toHaveBeenCalled();

            // Test what backbone does, just to make sure we're in line with whatever version we are using
            var bbEventListener = jasmine.createSpy('bbEventListener');
            var PlainModel = Backbone.Model.extend();
            var plainModel = new PlainModel();
            plainModel.set('a', 'oops');
            plainModel.on('change:a', bbEventListener);
            plainModel.unset('a', {silent: true});
            expect(bbEventListener).not.toHaveBeenCalled();
        });

        it('throws an error when called on a server model', function() {
            model = target._newServerModel('AllTypes');

            expect(function() {
                model.unset('embedded');
            }).toDxFail('Can not modify a server AllTypes instance.');
        });

        it('will silently not unset the type attribute', function() {
            var callback = jasmine.createSpy('callback');
            model.on('change:type', callback);

            model.unset('type');

            expect(model.get('type')).toEqual('AllTypes');
            expect(model.changedAttributes()).toEqual(false);
            expect(callback).not.toHaveBeenCalled();
        });

        it('will unset a reference attribute when specified with reference', function() {
            model = target._newClientModel('ReferenceType');
            model.set('sibling', 'SIBLING-1');

            model.unset('sibling');

            expect(model.get('sibling')).toEqual(null);
        });

        it('will unset a reference attribute when specified with $reference', function() {
            model = target._newClientModel('ReferenceType');
            model.set('sibling', 'SIBLING-1');

            model.unset('$sibling');

            expect(model.get('sibling')).toEqual(null);
        });
    });

    describe('clear()', function() {
        var model;
        beforeEach(function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({t: allTypes, simpleEmbeddedType: simpleEmbeddedType});
            dx.core.data._generateModelConstructors(schemas, target);

            model = target._newClientModel('AllTypes');
        });

        it('sets data types with default values to their defaults', function() {
            model.set('strDef', 'NewString');
            model.set('nullDef', null);
            model.set('boolDef', false);
            model.set('intDef', 20131004);
            model.set('numDef', 2013.1);

            model.clear();

            expect(model.get('strDef')).toBe('IAmDefault');
            expect(model.get('nullDef')).toBeUndefined();
            expect(model.get('boolDef')).toBe(true);
            expect(model.get('intDef')).toBe(45);
            expect(model.get('numDef')).toBe(84.5);
        });

        it('sets data types with without defaults to standard defaults', function() {
            model.set('strNoDef', 'NewString');
            model.set('nullNoDef', null);
            model.set('boolNoDef', false);
            model.set('intNoDef', 20131004);
            model.set('numNoDef', 2013.1);
            model.set('arrayNoDef', [2013, 10, 4]);
            model.set('objectNoDef', {year: 2013, month: 10, day: 4});

            model.clear();

            expect(model.get('strNoDef')).toBeUndefined();
            expect(model.get('nullNoDef')).toBeUndefined();
            expect(model.get('boolNoDef')).toBeUndefined();
            expect(model.get('intNoDef')).toBeUndefined();
            expect(model.get('numNoDef')).toBeUndefined();
            expect(model.get('arrayNoDef')).toBeUndefined();
            expect(model.get('objectNoDef')).toBeUndefined();
        });

        it('clears an embedded type, but does not replace it', function() {
            var embedded = model.get('embedded');
            embedded.set('strDef', 'This is a different value');

            model.clear();

            expect(model.get('embedded')).toBe(embedded);
            expect(model.get('embedded').get('strDef')).toBe('EmbeddedDefault');
        });

        it('does not clear the type attribute', function() {

            model.clear();

            expect(model.get('type')).toBe('AllTypes');
        });

        it('sets changed attributes just like Backbone\'s clear()', function() {
            model.set('intDef', 23);
            model.set('strDef', 'Initial');
            expect(model.changedAttributes()).toEqual({strDef: 'Initial'});

            model.clear();

            expect(model.changedAttributes()).toEqual({
                intDef : 45,
                strDef : 'IAmDefault'});

            // Test what backbone does, just to make sure we're in line with whatever version we are using
            var PlainModel = Backbone.Model.extend();
            var plainModel = new PlainModel();
            plainModel.set('a', '1');
            plainModel.set('b', '2');
            expect(plainModel.changedAttributes()).toEqual({b: '2'});

            plainModel.clear();

            expect(plainModel.changedAttributes()).toEqual({
                a: undefined,
                b: undefined
            });
        });

        it('does not register embedded objects as changedAttributes()', function() {
            model.set('embedded', {strDef: 'newValue'});
            model.set('strDef', 'Fun');
            expect(model.changedAttributes()).toEqual({strDef: 'Fun'});

            model.clear();

            expect(_.keys(model.changedAttributes())).not.toContain('embedded');
        });

        it('triggers events just like Backbone\'s clear()', function() {
            var eventListener = jasmine.createSpy('eventListener');
            model.set('strDef', 'non default value');
            model.on('change:strDef', eventListener);

            model.clear();

            expect(eventListener).toHaveBeenCalled();

            // Test what backbone does, just to make sure we're in line with whatever version we are using
            var bbEventListener = jasmine.createSpy('bbEventListener');
            var PlainModel = Backbone.Model.extend();
            var plainModel = new PlainModel();
            plainModel.set('a', 'oops');
            plainModel.on('change:a', bbEventListener);

            plainModel.clear();

            expect(bbEventListener).toHaveBeenCalled();
        });

        it('does not trigger events when silent:true is passed just like Backbone\'s clear()', function() {
            var eventListener = jasmine.createSpy('eventListener');
            model.on('change:strDef', eventListener);

            model.clear({silent: true});

            expect(eventListener).not.toHaveBeenCalled();

            // Test what backbone does, just to make sure we're in line with whatever version we are using
            var bbEventListener = jasmine.createSpy('bbEventListener');
            var PlainModel = Backbone.Model.extend();
            var plainModel = new PlainModel();
            plainModel.set('a', 'oops');
            plainModel.on('change:a', bbEventListener);

            plainModel.clear({silent: true});

            expect(bbEventListener).not.toHaveBeenCalled();
        });

        it('throws an error when called on a server model', function() {
            model = target._newServerModel('AllTypes');

            expect(function() {
                model.clear();
            }).toDxFail('Can not modify a server AllTypes instance.');
        });

        it('will do nothing harmful if called on a type with no properties', function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({t: {}});
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');

            model.clear();

            expect(model.changedAttributes()).toEqual(false);
        });
    });

    describe('toJSON()', function() {
        var model;
        var target;

        beforeEach(function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType,
                referenceType: simpleReferenceType
            });
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('AllTypes');
        });

        it('serializes all types with default values', function() {
            expect(model.toJSON()).toEqual({
                type: 'AllTypes',
                strDef: 'IAmDefault',
                nullDef: null,
                boolDef: true,
                intDef: 45,
                numDef: 84.5,
                strNoDef: null,
                nullNoDef: null,
                boolNoDef: null,
                intNoDef: null,
                numNoDef: null,
                dateNoDef : null,
                objectNoDef: null,
                arrayNoDef: null,
                embedded: {
                    strDef: 'EmbeddedDefault'
                }
            });
        });

        it('serializes custom values for all types, including models within plain arrays and objects', function() {
            model.set({
                strNoDef: 'Hi there',
                boolNoDef: true,
                intNoDef: -32767,
                numNoDef: 3.14,
                dateNoDef: '1977-05-25T00:00:00.001Z',
                arrayNoDef: [
                    true, {
                        aValue: null
                    }
                ],
                objectNoDef: {
                    key: 'value',
                    anArray: [
                        false,
                        'first',
                        2,
                        4.1
                    ]
                },
                embedded: {
                    strDef: 'aString'
                }
            });
            model.get('arrayNoDef').push(target._newClientModel('EmbeddedType'));
            model.get('objectNoDef').another = target._newClientModel('EmbeddedType');

            expect(model.toJSON()).toEqual({
                type: 'AllTypes',
                strDef: 'IAmDefault',
                nullDef: null,
                boolDef: true,
                intDef: 45,
                numDef: 84.5,
                strNoDef: 'Hi there',
                nullNoDef: null,
                boolNoDef: true,
                intNoDef: -32767,
                numNoDef: 3.14,
                dateNoDef: '1977-05-25T00:00:00.001Z',
                objectNoDef: {
                    key: 'value',
                    anArray: [
                        false,
                        'first',
                        2,
                        4.1
                    ],
                    another: {
                        strDef: 'EmbeddedDefault'
                    }
                },
                arrayNoDef: [
                    true, {
                        aValue: null
                    }, {
                        strDef: 'EmbeddedDefault'
                    }
                    ],
                embedded: {
                    strDef: 'aString'
                }
            });
        });

        it('makes a deep clone of objects and arrays', function() {
            model.set({
                strDef: 'Hi there',
                boolDef: true,
                intDef: -32767,
                numDef: 3.14,
                arrayNoDef: [
                    true, {
                        aValue: undefined
                    }
                ],
                objectNoDef: {
                    key: 'value',
                    anArray: [
                        false,
                        'first',
                        2,
                        4.1
                    ]
                },
                embedded: {
                    strDef: 'aString'
                }
            });
            model.get('arrayNoDef').push(target._newClientModel('EmbeddedType'));
            model.get('objectNoDef').another = target._newClientModel('EmbeddedType');

            expect(model.toJSON().objectNoDef).not.toBe(model.get('objectNoDef'));
            expect(model.toJSON().arrayNoDef).not.toBe(model.get('arrayNoDef'));
        });
    });

    describe('parse()', function() {
        var model;
        beforeEach(function() {
            var type = {
                name: 'TestType',
                properties: {
                    reference: {
                        type: 'string'
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({t: type});
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('TestType');
        });

        it('returns an empty hash if given no response', function() {
            spyOn(dx, 'warn');

            expect(model.parse()).toBeUndefined();
        });

        it('returns an empty hash if given no response', function() {
            spyOn(dx, 'warn');

            expect(model.parse()).toBeUndefined();
        });

        it('reports a warning if asked to parse something we dont know about', function() {
            spyOn(dx, 'warn');

            expect(model.parse({
                type: 'bogusness'
            })).toBeUndefined();
            expect(dx.warn).toHaveBeenCalled();
        });

        it('returns an the result value from an OKResult', function() {
            expect(model.parse({
                type: 'OKResult',
                result: {
                    type: 'TestType'
                }
            })).toEqual({
                type: 'TestType'
            });
        });

        it('returns an the input value when it is a non-CallResult type', function() {
            expect(model.parse({
                type: 'TestType'
            })).toEqual({
                type: 'TestType'
            });
        });
    });

    describe('clone()', function() {
        var model;
        beforeEach(function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({t: allTypes, simpleEmbeddedType: simpleEmbeddedType});
            dx.core.data._generateModelConstructors(schemas, target);

            model = target._newClientModel('AllTypes');
        });

        it('creates a distinct new model', function() {
            var newModel = model.clone();

            expect(newModel).not.toBeUndefined();
            expect(newModel).not.toBe(model);
        });

        it('creates a new instance with matching values', function() {
            model.set('strNoDef', 'NewString');
            model.set('nullNoDef', null);
            model.set('boolNoDef', false);
            model.set('intNoDef', 20131004);
            model.set('numNoDef', 2013.1);

            var newModel = model.clone();

            var origAttr = _.omit(model.attributes, ['embedded', 'objectNoDef', 'arrayNoDef']);
            var newAttr = _.omit(newModel.attributes, ['embedded', 'objectNoDef', 'arrayNoDef']);

            expect(origAttr).toEqual(newAttr);
        });

        it('creates deep copies of arrays and objects', function() {
            model.set('arrayNoDef', [true, 2, { three: 3 }]);
            model.set('objectNoDef', { one: 1, two: [ 'a', 'b']});

            var newModel = model.clone();

            expect(newModel.get('arrayNoDef')).toEqual(model.get('arrayNoDef'));
            expect(newModel.get('arrayNoDef')).not.toBe(model.get('arrayNoDef'));
            expect(newModel.get('objectNoDef')).toEqual(model.get('objectNoDef'));
            expect(newModel.get('objectNoDef')).not.toBe(model.get('objectNoDef'));
        });

        it('makes a new copy of an embedded object', function() {
            var embedded = model.get('embedded');
            embedded.set('strDef', 'This is a different value');

            var newModel = model.clone();

            expect(newModel.get('embedded')).not.toBe(embedded);
            expect(newModel.get('embedded').get('strDef')).toBe('This is a different value');
        });

        it('will create a client model, even if the source is source', function() {
            model = target._newServerModel('AllTypes');

            var newModel = model.clone();

            expect(function() {
                newModel.set('strDef');
            }).not.toThrow();
        });

        it('will not set changedAttributes, just like Backbone\'s clone()', function() {
            model.set('strDef', 'Another default');
            var newModel = model.clone();

            expect(newModel.changedAttributes()).toBe(false);

            // Test what backbone does, just to make sure we're in line with whatever version we are using
            var PlainModel = Backbone.Model.extend();
            var plainModel = new PlainModel();
            plainModel.set('a', 'oops');

            var newPlain = plainModel.clone();

            expect(newPlain.changedAttributes()).toBe(false);
        });
    });

    describe('instanceOf()', function() {
        var model;

        beforeEach(function() {
            target = {};
            var parent = {
                name: 'ParentType'
            };
            var child = {
                name: 'ChildType',
                'extends': {
                    $ref: 'p'
                }
            };
            var another = {
                name: 'UnrelatedType'
            };
            var schemas = dx.core.data._prepareSchemas({p: parent, c: child, r: another});
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('ChildType');
        });

        it('throws error if called with no parameters', function() {
            expect(function() {
                model.instanceOf();
            }).toDxFail(new Error('instanceOf() requires a type name as a parameter.'));
        });

        it('returns false if parameter is an nonexistent type name', function() {
            expect(function() {
                model.instanceOf('nonType');
            }).toDxFail(new Error('nonType is not a known type name.'));
        });

        it('returns false if parameter is an existing but unrelated type name', function() {
            expect(model.instanceOf('UnrelatedType')).toBe(false);
        });

        it('returns true if parameter is its own type name', function() {
            expect(model.instanceOf('ChildType')).toBe(true);
        });

        it('returns true if parameter is an ancestor type name', function() {
            expect(model.instanceOf('ParentType')).toBe(true);
        });

        it('will return true if parameter is an ancestor type name, and the model is read-only', function() {
            model = target._newServerModel('ChildType');

            expect(model.instanceOf('ParentType')).toBe(true);
        });
    });

    describe('isServerModel()', function() {
        var model;

        beforeEach(function() {
            target = {};
            var parent = {
                name: 'ParentType'
            };
            var schemas = dx.core.data._prepareSchemas({p: parent});
            dx.core.data._generateModelConstructors(schemas, target);
        });

        it('returns false if model is a client model', function() {
            model = target._newClientModel('ParentType');
            expect(model.isServerModel()).toBe(false);
        });

        it('returns true if model is a client model', function() {
            model = target._newServerModel('ParentType');
            expect(model.isServerModel()).toBe(true);
        });
    });

    describe('destroy()', function() {
        var model;
        var target;

        beforeEach(function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType
            });
            dx.core.data._generateModelConstructors(schemas, target);
        });

        it('will throw an error when called on a server model', function() {
            model = target._newServerModel('AllTypes');

            expect(function() {
                model.destroy();
            }).toDxFail(new Error('Do not call destroy() directly. Instead, call $$delete().'));
        });

        it('will throw an error when called on a client model', function() {
            model = target._newClientModel('AllTypes');

            expect(function() {
                model.destroy();
            }).toDxFail(new Error('Do not call destroy() directly. Instead, call $$delete().'));
        });
    });

    describe('save()', function() {
        var model;
        var target;

        beforeEach(function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType
            });
            dx.core.data._generateModelConstructors(schemas, target);
        });

        it('will throw an error when called on a server model', function() {
            model = target._newServerModel('AllTypes');

            expect(function() {
                model.save();
            }).toDxFail(new Error('Do not call save() directly. Instead, call $$update().'));
        });

        it('will throw an error when called on a client model', function() {
            model = target._newClientModel('AllTypes');

            expect(function() {
                model.save();
            }).toDxFail(new Error('Do not call save() directly. Instead, call $$update().'));
        });
    });

    describe('fetch()', function() {
        var model;
        var target;

        beforeEach(function() {
            target = {};
            var schemas = dx.core.data._prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType
            });
            dx.core.data._generateModelConstructors(schemas, target);
        });

        it('will throw an error when called on a server model', function() {
            model = target._newServerModel('AllTypes');

            expect(function() {
                model.fetch();
            }).toDxFail(new Error('Do not call fetch() directly. Instead, call getServerModel().'));
        });

        it('will throw an error when called on a client model', function() {
            model = target._newClientModel('AllTypes');

            expect(function() {
                model.fetch();
            }).toDxFail(new Error('Do not call fetch() directly. Instead, call getServerModel().'));
        });
    });

    describe('standard operations', function() {
        describe('$$delete()', function() {
            var ajaxSpy;
            var model;

            beforeEach(function() {
                var schema = {
                    name: 'HasDelete',
                    root: '/somewhere',
                    properties: { reference: { type: 'string' } },
                    'delete': {
                        payload: {
                            type: 'object',
                            $ref: 'd'
                        }
                    }
                };
                var childType = {
                    name: 'ChildType',
                    'extends': {
                        $ref: 't'
                    }
                };
                var noPayload = {
                    name: 'HasDeleteNoPayload',
                    root: '/somewhere',
                    properties: { reference: { type: 'string' } },
                    'delete': {}
                };
                var requiredPayload = {
                    name: 'HasDeleteRequiredPayload',
                    root: '/somewhere',
                    properties: { reference: { type: 'string' } },
                    'delete': {
                        payload: {
                            type: 'object',
                            $ref: 'd',
                            required: true
                        }
                    }
                };
                var delParams = {
                    name: 'DeleteParams',
                    properties: {
                        required: {
                            type: 'integer',
                            required: true
                        }
                    }
                };
                var noDelete = {
                    name: 'NoDelete',
                    root: '/somewhere',
                    properties: { reference: { type: 'string' } }
                };
                var okResult = {
                    name: 'OKResult',
                    properties: {
                        type: {
                            type: 'string'
                        }
                    }
                };
                var errorResult = {
                    name: 'ErrorResult',
                    properties: {
                        type: {
                            type: 'string'
                        }
                    }
                };
                target = {};
                ajaxSpy = spyOn(jQuery, 'ajax');
                var schemas = dx.core.data._prepareSchemas({
                    t: schema,
                    c: childType,
                    n: noDelete,
                    no: noPayload,
                    r: requiredPayload,
                    d: delParams,
                    err: errorResult,
                    ok: okResult
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('HasDelete');
            });

            it('is created on server models when specified in the schema', function() {
                expect(model.$$delete).toBeDefined();
            });

            it('is created for child types', function() {
                var childModel = target._newServerModel('ChildType');

                expect(childModel.$$delete).toBeDefined();
            });

            it('is not created  on client models, even when specified in the schema', function() {
                model = target._newClientModel('HasDelete');
                expect(model.$$delete).not.toBeDefined();
            });

            it('is not created on server models, when not specified in the schema', function() {
                model = target._newServerModel('NoDelete');
                expect(model.$$delete).not.toBeDefined();
            });

            it('will throw an error if no reference set', function() {
                model = target._newServerModel('HasDelete');

                expect(function() {
                    model.$$delete();
                }).toDxFail(new Error('$$delete can not be called without a reference property set.'));
            });

            it('passes correct parameters when called', function() {
                model._dxSet('reference', 'REF-1');

                model.$$delete();

                expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/REF-1');
                expect(ajaxSpy.mostRecentCall.args[0].type).toEqual('DELETE');
                expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
            });

            it('passes payload when given one', function() {
                model._dxSet('reference', 'REF-1');
                var params = target._newClientModel('DeleteParams');
                params.set('required', 34);

                model.$$delete(params);

                expect(ajaxSpy.mostRecentCall.args[0].data).toEqual('{"required":34}');
            });

            it('calls error callback on error', function() {
                model._dxSet('reference', 'REF-1');
                var errorSpy = jasmine.createSpy('errorSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult'
                    });
                });

                model.$$delete({error: errorSpy});

                expect(errorSpy).toHaveBeenCalled();
                expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
            });

            it('calls success callback on success, when no payload specified', function() {
                model._dxSet('reference', 'REF-1');
                var successSpy = jasmine.createSpy('successSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                model.$$delete({success: successSpy});

                expect(successSpy).toHaveBeenCalled();
                expect(successSpy.mostRecentCall.args[0].get('type')).toEqual('OKResult');
            });

            it('calls success callback on success, when payload specified', function() {
                model._dxSet('reference', 'REF-1');
                var successSpy = jasmine.createSpy('successSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });
                var params = target._newClientModel('DeleteParams');
                params.set('required', 34);

                model.$$delete(params, {success: successSpy});

                expect(successSpy).toHaveBeenCalled();
                expect(successSpy.mostRecentCall.args[0].get('type')).toEqual('OKResult');
            });

            it('doesn\'t complain if no success handler was specified on success', function() {
                model._dxSet('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                expect(function() {
                    model.$$delete();
                }).not.toThrow();
            });

            it('throws an error if not called with a payload when one required', function() {
                model = target._newServerModel('HasDeleteRequiredPayload');
                model._dxSet('reference', 'REF-1');

                expect(function() {
                    model.$$delete({success: function() {}});
                }).toDxFail(new Error('Must call $$delete with a payload of type DeleteParams.'));
            });

            it('throws an error if called with a payload when none defined', function() {
                model = target._newServerModel('HasDeleteNoPayload');
                model._dxSet('reference', 'REF-1');
                var params = target._newClientModel('DeleteParams');
                params.set('required', 34);

                expect(function() {
                    model.$$delete(params, {success: function() {}});
                }).toDxFail(new Error('$$delete does not allow a payload.'));
            });

            describe('returned Promise', function() {
                var successSpy, errorSpy;

                beforeEach(function() {
                    successSpy = jasmine.createSpy('success');
                    errorSpy = jasmine.createSpy('error');
                });

                it('is resolved on success', function() {
                    model._dxSet('reference', 'REF-1');
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'OKResult'
                        });
                    });

                    var promise = model.$$delete();
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).toHaveBeenCalled();
                    expect(errorSpy).not.toHaveBeenCalled();
                });

                it('is rejected on error', function() {
                    model._dxSet('reference', 'REF-1');
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'ErrorResult'
                        });
                    });

                    var promise = model.$$delete();
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).not.toHaveBeenCalled();
                    expect(errorSpy).toHaveBeenCalled();
                });
            });
        });

        describe('$$update()', function() {
            var ajaxSpy;
            var model;

            beforeEach(function() {
                var schema = {
                    name: 'RootType',
                    root: '/somewhere',
                    properties: {
                        reference: {
                            type: 'string'
                        },
                        required: {
                            type: 'number',
                            required:true
                        }
                    },
                    update: {
                        payload: {
                            type: 'object',
                            $ref: 't'
                        }
                    }
                };
                var childType = {
                    name: 'ChildType',
                    'extends': {
                        $ref: 't'
                    }
                };
                var updateWithAll = {
                    name: 'UpdateType',
                    root: '/somewhere',
                    properties: {
                        reference: {
                            type: 'string'
                        },
                        requiredTrue: {
                            type: 'string',
                            required:true
                        },
                        requiredFalse: {
                            type: 'string',
                            required:false
                        },
                        updateRequired: {
                            type: 'string',
                            update: 'required'
                        },
                        updateOptional: {
                            type: 'string',
                            update: 'optional'
                        },
                        updateReadonly: {
                            type: 'string',
                            update: 'readonly'
                        },
                        updateUnspecified: {
                            type: 'string'
                        }
                    },
                    update: {
                        payload: {
                            type: 'object',
                            $ref: 'u'
                        }
                    }
                };
                target = {};
                ajaxSpy = spyOn(jQuery, 'ajax');
                var schemas = dx.core.data._prepareSchemas({
                    t: schema,
                    c: childType,
                    api: dx.test.dataMocks.apiErrorSchema,
                    call: dx.test.dataMocks.callResultSchema,
                    ok: dx.test.dataMocks.okResultSchema,
                    e : dx.test.dataMocks.errorResultSchema,
                    u: updateWithAll
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('RootType');
            });

            it('is created when specified in the schema', function() {
                expect(model.$$update).toBeDefined();
            });

            it('is created for child types', function() {
                var childModel = target._newServerModel('ChildType');

                expect(childModel.$$update).toBeDefined();
            });

            it('throws an error if called on an object without a reference', function() {
                expect(function() {
                    model.$$update({
                        required: 45
                    });
                }).toDxFail('$$update can not be called without a reference property set.');
            });

            it('throws an error if called without a parameter', function() {
                model._dxSet('reference', 'REF-1');
                expect(function() {
                    model.$$update();
                }).toDxFail('$$update must be called with a non-empty set of attributes.');
            });

            it('will throw an error if called with an empty attributes hash', function() {
                model._dxSet({
                   reference: 'REF-1'
                });

                expect(function() {
                    model.$$update({});
                }).toDxFail('$$update must be called with a non-empty set of attributes.');
            });

            it('will send all required attrs, but no optional ones if they aren\'t in update() call', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                   reference: 'REF-1',
                   requiredTrue: 'alwaysRequired',
                   requiredFalse: 'notRequired',
                   updateRequired: 'required',
                   updateOptional: 'optional',
                   updateReadonly: 'readonly',
                   updateUnspecified: 'unspecified'
                });
                model.$$update({
                   requiredTrue: 'newRequiredValue'
                });
                expect(ajaxSpy.mostRecentCall.args[0].data).
                    toEqual('{"requiredTrue":"newRequiredValue","updateRequired":"required"}');
            });

            it('will send all optional values passed to update, but not readonly ones', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                   reference: 'REF-1'
                });
                model.$$update({
                   requiredTrue: '1',
                   requiredFalse: '2',
                   updateRequired: '3',
                   updateOptional: '4',
                   updateReadonly: '5',
                   updateUnspecified: '6'
                });
                expect(ajaxSpy.mostRecentCall.args[0].data).
                    toEqual('{"requiredTrue":"1","requiredFalse":"2","updateRequired":"3","updateOptional":"4"}');
            });

            it('will not send non-required values passed to update, but that have not changed', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                    reference: 'REF-1',
                    requiredTrue: '1',
                    requiredFalse: '2',
                    updateRequired: '3',
                    updateOptional: '4',
                    updateReadonly: '5',
                    updateUnspecified: '6'
                });
                model.$$update({
                    requiredTrue: '1',
                    requiredFalse: '2',
                    updateRequired: '3',
                    updateOptional: '4',
                    updateReadonly: '5',
                    updateUnspecified: '6'
                });
                expect(ajaxSpy.mostRecentCall.args[0].data).toEqual('{"requiredTrue":"1","updateRequired":"3"}');
            });

            it('will throw an error if one tries to update a non-nullable optional value with null', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                    reference: 'REF-1',
                    requiredTrue: '1',
                    requiredFalse: '2',
                    updateRequired: '3',
                    updateOptional: '4',
                    updateReadonly: '5',
                    updateUnspecified: '6'
                });
                expect(function() {
                    model.$$update({
                        updateOptional: null
                    });
                }).toDxFail('The attribute updateOptional is required to be non-null/non-undefined.');
            });

            it('will throw an error if required attrs are not set in the model or specified in update', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                   reference: 'REF-1'
                });

                expect(function() {
                    model.$$update({
                       requiredFalse: '2',
                       updateOptional: '4',
                       updateUnspecified: '6'
                    });
                }).toDxFail('The attribute requiredTrue is required to be non-null/non-undefined.');
            });

            it('will send null for a type which can be null when it is set to null', function() {
                var nullType = {
                    name: 'NullableType',
                    root: '/somewhere',
                    properties: {
                        reference: {
                            type: ['string', 'null']
                        },
                        requiredTrue: {
                            type: ['string', 'null'],
                            required:true
                        },
                        requiredFalse: {
                            type: ['string', 'null'],
                            required:false
                        },
                        updateRequired: {
                            type: ['string', 'null'],
                            update: 'required'
                        },
                        updateOptional: {
                            type: ['string', 'null'],
                            update: 'optional'
                        }
                    },
                    update: {
                        payload: {
                            type: 'object',
                            $ref: 'u'
                        }
                    }
                };
                target = {};
                var schemas = dx.core.data._prepareSchemas({u: nullType});
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('NullableType');
                model._dxSet({
                   reference: 'REF-1',
                    requiredFalse: 'tempValue',
                    updateOptional: 'tempValue1'
                });

                model.$$update({
                   requiredFalse: null,
                   updateOptional: null
                });

                expect(ajaxSpy.mostRecentCall.args[0].data).
                    toEqual('{"requiredTrue":null,"requiredFalse":null,"updateRequired":null,"updateOptional":null}');
            });

            it('will not send null for a type which can be null but isn\'t', function() {
                var nullType = {
                    name: 'NullableType',
                    root: '/somewhere',
                    properties: {
                        reference: {
                            type: ['string', 'null']
                        },
                        other: {    // just need one type to update
                            type: 'string',
                            required:true
                        },
                        requiredTrue: {
                            type: ['string', 'null'],
                            required:true
                        },
                        requiredFalse: {
                            type: ['string', 'null'],
                            required:false
                        },
                        updateRequired: {
                            type: ['string', 'null'],
                            update: 'required'
                        },
                        updateOptional: {
                            type: ['string', 'null'],
                            update: 'optional'
                        }
                    },
                    update: {
                        payload: {
                            type: 'object',
                            $ref: 'u'
                        }
                    }
                };
                target = {};
                var schemas = dx.core.data._prepareSchemas({u: nullType});
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('NullableType');
                model._dxSet({
                    reference: 'REF-1',
                    requiredTrue: 'value1',
                    requiredFalse: 'value2',
                    updateRequired: 'value3',
                    updateOptional: 'value4'
                });

                model.$$update({
                    other: 'placeholder'
                });

                expect(ajaxSpy.mostRecentCall.args[0].data).
                    toEqual('{"other":"placeholder","requiredTrue":"value1","updateRequired":"value3"}');
            });

            it('will accept "" as a return value', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                   'reference': 'REF-1'
                });
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: ''
                    });
                });

                expect(function() {
                    model.$$update({
                       'requiredTrue': 'alwaysRequired',
                       'updateRequired': 'required'
                    });
                }).not.toThrow();
            });

            describe('updating embedded objects', function() {
                beforeEach(function() {
                    var root = {
                        name: 'RootType',
                        root: '/somewhere',
                        properties: {
                            reference: {
                                type: 'string'
                            },
                            type: {
                                type: 'string'
                            },
                            other: {
                                type: 'string'
                            },
                            requiredTrue: {
                                type: ['string', 'null'],
                                required:true
                            },
                            requiredFalse: {
                                type: ['string', 'null'],
                                required:false
                            },
                            updateRequired: {
                                type: ['string', 'null'],
                                update: 'required'
                            },
                            updateOptional: {
                                type: ['string', 'null'],
                                update: 'optional'
                            },
                            embedded: {
                                type: 'object',
                                $ref: 'c',
                                update: 'optional'
                            }
                        },
                        update: {
                            payload: {
                                type: 'object',
                                $ref: 'p'
                            }
                        }
                    };
                    var embedded = {
                        name: 'EmbeddedType',
                        properties: {
                            type: {
                                type: 'string',
                                required: true
                            },
                            embRequiredTrue: {
                                type: ['string', 'null'],
                                required:true
                            },
                            embRequiredFalse: {
                                type: ['string', 'null'],
                                required:false
                            },
                            embUpdateRequired: {
                                type: ['string', 'null'],
                                update: 'required'
                            },
                            embUpdateOptional: {
                                type: ['string', 'null'],
                                update: 'optional'
                            },
                            subEmbedded: {
                                type: 'object',
                                $ref: 'g',
                                update: 'optional'
                            }
                        }
                    };
                    var extendedEmbedded = {
                        name: 'ExtendedEmbeddedType',
                        'extends': {
                            $ref: 'c'
                        },
                        properties: {
                            nameForTesting: {
                                type: 'string',
                                required:true
                            }
                        }
                    };
                    var subembedded = {
                        name: 'SubEmbedded',
                        properties: {
                            type: {
                                type: 'string'
                            },
                            subRequiredTrue: {
                                type: ['string', 'null'],
                                required:true
                            },
                            subRequiredFalse: {
                                type: ['string', 'null'],
                                required:false
                            },
                            subUpdateRequired: {
                                type: ['string', 'null'],
                                update: 'required'
                            },
                            subUpdateOptional: {
                                type: ['string', 'null'],
                                update: 'optional'
                            }
                        }
                    };
                    target = {};
                    var schemas = dx.core.data._prepareSchemas({
                        p: root,
                        c: embedded,
                        g: subembedded,
                        x: extendedEmbedded,
                        api: dx.test.dataMocks.apiErrorSchema,
                        call: dx.test.dataMocks.callResultSchema,
                        ok: dx.test.dataMocks.okResultSchema,
                        e : dx.test.dataMocks.errorResultSchema
                    });
                    dx.core.data._generateModelConstructors(schemas, target);
                });

                it('won\'t send them when they have no new data, even when they have required values', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        requiredTrue: 'required',
                        updateRequired: 'updateRequired',
                        embedded: {
                            embRequiredTrue: 'required',
                            embUpdateRequired: 'updateRequired'
                        }
                    });

                    model.$$update({
                        requiredTrue: 'someValue'
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).
                        toEqual('{"requiredTrue":"someValue","updateRequired":"updateRequired"}');
                });

                it('won\'t send optional sub-embedded when they have no new data, even when they have required values',
                    function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        requiredTrue: 'r',
                        updateRequired: 'r',
                        embedded: {
                            embRequiredTrue: 'er',
                            embUpdateRequired: 'er'
                        }
                    });

                    model.$$update({
                        embedded: {
                            embRequiredTrue: 'required'
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).
                        toEqual('{"requiredTrue":"r","updateRequired":"r","embedded":{"type":"EmbeddedType",' +
                            '"embRequiredTrue":"required","embUpdateRequired":"er"}}');
                });

                it('will send them when they have data that should be sent', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1'
                    });

                    model.$$update({
                        embedded: {
                            type: 'EmbeddedType',
                            subEmbedded: {
                                subRequiredTrue: 'sr',
                                subUpdateRequired: 'sr'
                            }
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":null,"embUpdateRequired":null,"subEmbedded":{"subRequiredTrue":"sr",' +
                        '"subUpdateRequired":"sr"}}}');
                });

                it('will send an embedded optional value', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: 'fred'
                            }
                        }
                    });

                    model.$$update({
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: 'new'
                            }
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":null,"embUpdateRequired":null,"subEmbedded":{"subRequiredTrue":null,' +
                        '"subUpdateRequired":null,"subUpdateOptional":"new"}}}');
                });

                it('will send an embedded value which is set to undefined', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: 'fred'
                            }
                        }
                    });

                    model.$$update({
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: undefined
                            }
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":null,"embUpdateRequired":null,"subEmbedded":{"subRequiredTrue":null,' +
                        '"subUpdateRequired":null,"subUpdateOptional":null}}}');
                });

                it('will not send an embedded optional value that hasn\'t changed', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: 'fred'
                            }
                        }
                    });

                    model.$$update({
                        embedded: {
                            subEmbedded: {
                                subUpdateRequired: 'new'
                            }
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":null,"embUpdateRequired":null,"subEmbedded":{"subRequiredTrue":null,' +
                        '"subUpdateRequired":"new"}}}');
                });

                it('sends an update that changes the type of an embedded object to a subtype', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            embRequiredTrue: 'yep'
                        }
                    });

                    model.$$update({
                        embedded: {
                            type: 'ExtendedEmbeddedType',
                            nameForTesting: 'testName'
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"nameForTesting":"testName",' +
                        '"type":"ExtendedEmbeddedType","embRequiredTrue":null,"embUpdateRequired":null}}');
                });

                it('sends an update that changes the type of an embedded object to a super type', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            type: 'ExtendedEmbeddedType',
                            nameForTesting: 'testName',
                            embUpdateRequired: 'I should not carry over'
                        }
                    });

                    model.$$update({
                        embedded: {
                            type: 'EmbeddedType',
                            embRequiredTrue: 'valueIncluded'
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":"valueIncluded","embUpdateRequired":null}}');
                });

                it('throws an error when asked to do an update that changes the type to an incompatible type',
                        function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            type: 'ExtendedEmbeddedType',
                            nameForTesting: 'testName'
                        }
                    });

                    expect(function() {
                        model.$$update({
                            embedded: {
                                type: 'RootType',
                                reference: 'bogus'
                            }
                        });
                    }).toDxFail('embedded has to be type object/EmbeddedType but is object/RootType');

                });

            });

            it('calls success callback on success', function() {
                model._dxSet('reference', 'REF-1');
                var successSpy = jasmine.createSpy('successSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                model.$$update({
                    required: 34
                }, {success: successSpy});

                expect(successSpy).toHaveBeenCalled();
                expect(successSpy.mostRecentCall.args[0].get('type')).toEqual('OKResult');
            });

            it('calls error callback on error', function() {
                model._dxSet('reference', 'REF-1');
                var errorSpy = jasmine.createSpy('errorSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult'
                    });
                });

                model.$$update({
                    required: 34
                }, {error: errorSpy});

                expect(errorSpy).toHaveBeenCalled();
                expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
            });

            describe('returned Promise', function() {
                var successSpy, errorSpy;

                beforeEach(function() {
                    successSpy = jasmine.createSpy('success');
                    errorSpy = jasmine.createSpy('error');
                });

                it('is resolved on success', function() {
                    model._dxSet('reference', 'REF-1');
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'OKResult'
                        });
                    });

                    var promise = model.$$update({
                        required: 34
                    });
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).toHaveBeenCalled();
                    expect(errorSpy).not.toHaveBeenCalled();
                });

                it('is rejected on error', function() {
                    model._dxSet('reference', 'REF-1');
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'ErrorResult'
                        });
                    });

                    var promise = model.$$update({
                        required: 34
                    });
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).not.toHaveBeenCalled();
                    expect(errorSpy).toHaveBeenCalled();
                });
            });
        });

        describe('$$create()', function() {
            var ajaxSpy;

            function prepareForTest(paramType, secondParamType) {
                var schema = {
                    name: 'RootType',
                    root: '/somewhere',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        reference: { type: 'string' } },
                    create: {
                        payload: {
                            type: 'object',
                            $ref: 't'
                        }
                    }
                };
                var weirdSchema = {
                    name: 'WeirdCreate',
                    root: '/somewhere',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        reference: {
                            type: 'string' }
                        },
                    create: {
                        payload: {
                            type: 'object',
                            $ref: 't'
                        }
                    }
                };
                var childType = {
                    name: 'ChildType',
                    'extends': {
                        $ref: 't'
                    }
                };
                target = {};
                ajaxSpy = spyOn(jQuery, 'ajax');
                var schemas = dx.core.data._prepareSchemas({
                    t: paramType,
                    two: secondParamType,
                    r: schema,
                    c: childType,
                    o: dx.test.dataMocks.okResultSchema,
                    call: dx.test.dataMocks.callResultSchema,
                    api: dx.test.dataMocks.apiErrorSchema,
                    e: dx.test.dataMocks.errorResultSchema,
                    w: weirdSchema
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
            }

            it('is created when specified in the schema', function() {
                prepareForTest({}, {});
                expect(target.rootOps.RootType.$$create).toBeDefined();
            });

            it('is not created for child types', function() {
                prepareForTest({}, {});
                expect(target.rootOps.ChildType).not.toBeDefined();
            });

            it('can be called, even when type not explicitly stated in original schema', function() {
                prepareForTest({ name: 'SimpleParam' }, {});

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'));

                expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere');

            });

            it('can be called with a different kind of parameter than the type that create is defined on', function() {
                prepareForTest({ name: 'SimpleParam' }, {});

                target.rootOps.WeirdCreate.$$create(target._newClientModel('SimpleParam'));

                expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere');
            });

            it('throws an error if passed an invalid parameter', function() {
                prepareForTest({ name: 'SimpleParam' }, {});

                expect(function() {
                    target.rootOps.WeirdCreate.$$create(target._newClientModel('APIError'));
                }).toDxFail('Must call $$create with an instance of SimpleParam.');
            });

            it('invokes the correct POST URL on the server', function() {
                prepareForTest({ name: 'SimpleParam' }, {});

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'));

                expect(ajaxSpy.mostRecentCall.args[0].type).toEqual('POST');
                expect(ajaxSpy.mostRecentCall.args[0].url).toEqual('/somewhere');
            });

            it('calls success callback on success', function() {
                prepareForTest({ name: 'SimpleParam' }, {});
                var successSpy = jasmine.createSpy('successSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'), {success: successSpy});

                expect(successSpy).toHaveBeenCalled();
                expect(successSpy.mostRecentCall.args[0].get('type')).toEqual('OKResult');
            });

            it('calls error callback on error', function() {
                prepareForTest({ name: 'SimpleParam' }, {});
                var errorSpy = jasmine.createSpy('errorSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'), {error: errorSpy});

                expect(errorSpy).toHaveBeenCalled();
                expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
            });

            it('copes with a timeout error', function() {
                prepareForTest({ name: 'SimpleParam' }, {});
                var errorSpy = jasmine.createSpy('errorSpy');
                // FYI: a timeout jqxhr looks like: {'readyState':0,'status':0,'statusText':'timeout'}
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 0,
                        readyState: 0,
                        getResponseHeader: function() {
                            return undefined;
                        },
                        statusText: 'timeout'
                    }, 'timeout', 'whatever');
                });

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'), {error: errorSpy});

                expect(errorSpy).toHaveBeenCalled();
                expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
            });

            it('will report an error if a create:required parameter is not set', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        first: {
                            type: 'string',
                            create: 'required'
                        }
                    }
                }, {});

                expect(function() {
                    target.rootOps.RootType.$$create(target._newClientModel('RequiredParams'));
                }).toDxFail('The attribute first is required to be non-null/non-undefined.');
            });

            it('will report an error if a create:required parameter in an embedded object is not set', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        first: {
                            type: 'string',
                            create: 'required'
                        },
                        embedded: {
                            type: 'object',
                            $ref: 'two',
                            required: true
                        }
                    }
                }, {
                    name: 'ChildRequired',
                    properties: {
                        first: {
                            type: 'string',
                            create: 'required'
                        }
                    }
                });

                var payload = target._newClientModel('RequiredParams');
                payload.set('first', 'hello');

                expect(function() {
                    target.rootOps.RootType.$$create(payload);
                }).toDxFail('The attribute first is required to be non-null/non-undefined.');
            });

            it('will send a null value if the property type is "null"', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        first: {
                            type: 'null',
                            create: 'required'
                        },
                        embedded: {
                            type: 'object',
                            $ref: 'two',
                            required: true
                        }
                    }
                }, {
                    name: 'ChildRequired',
                    properties: {
                        first: {
                            type: 'null',
                            create: 'required'
                        }
                    }
                });
                var payload = target._newClientModel('RequiredParams');

                target.rootOps.RootType.$$create(payload);

                expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"first":null,"embedded":{"first":null}}');
            });

            it('will not send non-required properties if they are null', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        createRequired: {
                            type: 'string',
                            create: 'required'
                        },
                        createOptional: {
                            type: 'string',
                            create: 'optional'
                        },
                        createReadonly: {
                            type: 'string',
                            create: 'readonly'
                        },
                        createUnspecified: {
                            type: 'string'
                        },
                        embedded: {
                            type: 'object',
                            $ref: 'two',
                            create: 'optional'
                        }
                    }
                }, {
                    name: 'ChildRequired',
                    properties: {
                        createRequired: {
                            type: 'string',
                            create: 'required'
                        },
                        createOptional: {
                            type: 'string',
                            create: 'optional'
                        },
                        createReadonly: {
                            type: 'string',
                            create: 'readonly'
                        },
                        createUnspecified: {
                            type: 'string'
                        }
                    }
                });
                var payload = target._newClientModel('RequiredParams');

                payload.set({
                    createRequired: 'one',
                    createReadonly: 'three',
                    createUnspecified: 'four',
                    embedded: {
                        createRequired: 'eleven',
                        createReadonly: 'thirteen',
                        createUnspecified: 'fourteen'
                    }
                });

                target.rootOps.RootType.$$create(payload);

                expect(jQuery.ajax.mostRecentCall.args[0].data).
                    toEqual('{"createRequired":"one","embedded":{"createRequired":"eleven"}}');
            });

            it('will send create required and optional attrs if they are non-null (but not readonly ones)', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        createRequired: {
                            type: 'string',
                            create: 'required'
                        },
                        createOptional: {
                            type: 'string',
                            create: 'optional'
                        },
                        createReadonly: {
                            type: 'string',
                            create: 'readonly'
                        },
                        createUnspecified: {
                            type: 'string'
                        },
                        embedded: {
                            type: 'object',
                            $ref: 'two',
                            required: true
                        }
                    }
                }, {
                    name: 'ChildRequired',
                    properties: {
                        createRequired: {
                            type: 'string',
                            create: 'required'
                        },
                        createOptional: {
                            type: 'string',
                            create: 'optional'
                        },
                        createReadonly: {
                            type: 'string',
                            create: 'readonly'
                        },
                        createUnspecified: {
                            type: 'string'
                        }
                    }
                });
                var payload = target._newClientModel('RequiredParams');

                payload.set({
                    createRequired: 'one',
                    createOptional: 'second',
                    createReadonly: 'three',
                    embedded: {
                        createRequired: 'eleven',
                        createOptional: 'twelve',
                        createReadonly: 'thirteen'
                    }
                });

                target.rootOps.RootType.$$create(payload);

                expect(jQuery.ajax.mostRecentCall.args[0].data).
                    toEqual('{"createRequired":"one","createOptional":"second","embedded":' +
                        '{"createRequired":"eleven","createOptional":"twelve"}}');
            });

            it('will throw an error if called with a payload when it isn\'t defined to accept one', function() {
                prepareForTest({
                    root: '/someurl',
                    name: 'NoPayload',
                    create: {
                    }
                }, {
                    name: 'Dummy'
                });
                var payload = target._newClientModel('Dummy');

                expect(function() {
                    target.rootOps.NoPayload.$$create(payload);
                }).toDxFail(new Error('$$create does not allow a payload.'));
            });

            it('will call success when called without a payload (and it is not defined to have one)', function() {
                prepareForTest({
                    root: '/someurl',
                    name: 'NoPayload',
                    create: {
                    }
                }, {
                    name: 'Dummy'
                });
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });
                var successSpy = jasmine.createSpy('successSpy');

                target.rootOps.NoPayload.$$create({
                    success: successSpy
                });

                expect(successSpy).toHaveBeenCalled();
            });

            describe('returned Promise', function() {
                var successSpy, errorSpy;

                beforeEach(function() {
                    successSpy = jasmine.createSpy('success');
                    errorSpy = jasmine.createSpy('error');
                });

                it('is resolved on success', function() {
                    prepareForTest({ name: 'SimpleParam' }, {});
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'OKResult'
                        });
                    });

                    var promise = target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'));
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).toHaveBeenCalled();
                    expect(errorSpy).not.toHaveBeenCalled();
                });

                it('is rejected on error', function() {
                    prepareForTest({ name: 'SimpleParam' }, {});
                    var errorSpy = jasmine.createSpy('errorSpy');
                    ajaxSpy.andCallFake(function(options) {
                        options.error({
                            status: 404,
                            getResponseHeader: function() {
                                return 'application/json';
                            },
                            responseText: '{"type":"ErrorResult"}'
                        }, 'error', 'whatever');
                    });

                    var promise = target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'));
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).not.toHaveBeenCalled();
                    expect(errorSpy).toHaveBeenCalled();
                });
            });
        });
    });

    /*
     * Note: This next group of tests exercises a lot of the common code used across most/all operation types. Thus,
     * there are tests for cases here that are not covered again in other kinds of object operations, rootOperations
     * and some standard operations.
     */
    describe('$noPayloadObjectOperation()', function() {
        var ajaxSpy;
        var model;
        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    noPayload: {
                        payload: {}
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType,
                o: dx.test.dataMocks.okResultSchema,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema
            });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$noPayload).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$noPayload).toBeDefined();
        });

        it('can be called with no parameters', function() {
            model.set('reference', 'REF-1');
            model.$noPayload();
            expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/REF-1/noPayload');
            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
        });

        it('can not be called if there is no reference', function() {

            expect(function() {
                model.$noPayload();
            }).toDxFail('$noPayload can not be called without a reference property set.');
        });

        it('reports an error if called with a payload', function() {
            model.set('reference', 'REF-1');
            expect(function() {
                model.$noPayload(target._newClientModel('ChildType'));
            }).toDxFail('$noPayload can not be called with a payload (only a success/error object).');
        });

        it('will call success callback with the successful result', function() {
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            model.$noPayload({
                success: successCallback
            });

            expect(successCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(successCallback.mostRecentCall.args[0].get('type')).toEqual('OKResult');
        });

        it('will not complain if no success callback is provided and the call is successful', function() {
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            expect(function() {
                model.$noPayload({});
            }).not.toThrow();
        });

        it('will call error callback if it receives an ErrorResult', function() {
            var errorCallback = jasmine.createSpy('error');
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult',
                    error: {
                        type: 'APIError'
                    }
                });
            });

            model.$noPayload({
                success: successCallback,
                error: errorCallback
            });

            expect(successCallback).not.toHaveBeenCalled();
            expect(errorCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(errorCallback.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
        });

        it('will call system error handler if no error handler provided and the call creates ErrorResult', function() {
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            spyOn(target, 'reportErrorResult');

            model.$noPayload({});
            expect(target.reportErrorResult).toHaveBeenCalled();
        });

        it('will not call system error handler if no error handler provided but suppressDefaultErrorHandler is true',
            function() {
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            spyOn(target, 'reportErrorResult');

            model.$noPayload({
                suppressDefaultErrorHandler: true
            });
            expect(target.reportErrorResult).not.toHaveBeenCalled();
        });

        it('will call error callback with an ErrorResult when it gets an ajax error with ErrorResult', function() {
            var errorCallback = jasmine.createSpy('error');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: '{"type":"ErrorResult"}'
                }, 'error', 'whatever');
            });

            model.$noPayload({
                error: errorCallback
            });

            expect(errorCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(errorCallback.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
        });

        it('throws an error if it gets an error with something claiming to be JSON data but isn\'t', function() {
            var errorCallback = jasmine.createSpy('error');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: 'this is junk, I tell you'
                }, 'error', 'whatever');
            });

            expect(function() {
                model.$noPayload({
                    error: errorCallback
                });
            }).toDxFail('Server response claimed to be application/json, but couldn\'t be parsed as JSON (this ' +
                'is junk, I tell you).');
        });

        it('will call system error handler if no error callback provided and it gets an ajax error', function() {
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: '{"type":"ErrorResult"}'
                }, 'error', 'whatever');
            });
            spyOn(target, 'reportErrorResult');

            model.$noPayload({});
            expect(target.reportErrorResult).toHaveBeenCalled();
        });

        it('will call error callback if it receives an ordinary ajax failure', function() {
            var errorCallback = jasmine.createSpy('error');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text/html';
                    },
                    responseText: '<html></html>'
                }, 'error', 'whatever');
            });

            model.$noPayload({
                error: errorCallback
            });

            expect(errorCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(errorCallback.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
        });

        it('will call system error handler if no error callback is provided when get ajax error', function() {
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text/html';
                    },
                    responseText: '<html></html>'
                }, 'error', 'whatever');
            });
            spyOn(target, 'reportErrorResult');

            model.$noPayload({});
            expect(target.reportErrorResult).toHaveBeenCalled();
        });

        it('will throw an error if the success handler isn\'t a function', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$noPayload({
                    success: 'Hi there'
                });
            }).toDxFail(new Error('The success handler must be a function, but found a string.'));
        });

        it('will throw an error if the error handler isn\'t a function', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$noPayload({
                    error: 'Hi there'
                });
            }).toDxFail(new Error('The error handler must be a function, but found a string.'));
        });

        it('will trigger a "request" event when it calls the server', function() {
            model.set('reference', 'REF-1');
            var requestSpy = jasmine.createSpy('requestSpy');
            model.on('request', requestSpy);

            model.$noPayload();

            expect(requestSpy).toHaveBeenCalled();
        });

        describe('(operation return values)', function() {
            function prepareForTest(returnType) {
                target = {};
                var schema = {
                    root: '/somewhere',
                    properties: { reference: { type: 'string' } },
                    operations: {
                        noPayload: {
                            payload: {}
                        }
                    }
                };
                var okResult = {
                    name: 'OKResult',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        result: {
                            type: ['object', 'string', 'array']
                        }
                    }
                };
                var dummy1 = {
                    name: 'Dummy1',
                    properties: {
                        type: {
                            type: 'string'
                        }
                    }
                };
                var dummy2 = {
                    name: 'Dummy2',
                    properties: {
                        type: {
                            type: 'string'
                        }
                    }
                };
                var serverModelType = {
                    name: 'ServerModelType',
                    root: '/somehwereElse',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        reference: {
                            type: 'string'
                        }
                    }
                };
                var withObjectsAndArrays = {
                    name: 'WithObjectsAndArrays',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        anObject: {
                            type: 'object'
                        },
                        anArray: {
                            type: 'array'
                        }
                    }
                };

                if (returnType) {
                    schema.operations.noPayload.return = returnType;
                }
                var schemas = dx.core.data._prepareSchemas({
                    t: schema,
                    ok: okResult,
                    d1: dummy1,
                    d2: dummy2,
                    smt: serverModelType,
                    woa: withObjectsAndArrays
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newClientModel('t');
            }

            it('will throw an error if there is no return value', function() {
                prepareForTest({ type: 'string' });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success();
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('Operation returned success, but without a typed object: undefined'));
            });

            it('will throw an error if the result type isn\'t a typed object', function() {
                prepareForTest({ type: 'string' });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({});
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('Operation returned success, but without a typed object: [object Object]'));
            });

            it('will accept a return type which matches the definition for a simple type', function() {
                prepareForTest({ type: 'string' });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: 'hi'
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).not.toThrow();
            });

            it('will accept a return type which matches the definition for an object type', function() {
                prepareForTest({
                    type: 'object',
                    $ref: 'd1'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'Dummy1'
                        }
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).not.toThrow();
            });

            it('will pass the raw json returned to the jsonSuccess handler', function() {
                var returnValue;
                prepareForTest({
                    type: 'object',
                    $ref: 'smt'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'ServerModelType',
                            reference: 'SMT-1'
                        }
                    });
                });

                model.$noPayload({ jsonSuccess: function(result) {
                    returnValue = result;
                }});

                expect(returnValue).toEqual({
                    type: 'OKResult',
                    result: {
                        type: 'ServerModelType',
                        reference: 'SMT-1'
                    }
                });
            });

            it('will convert a return value with a reference property to a server model', function() {
                var returnValue;
                prepareForTest({
                    type: 'object',
                    $ref: 'smt'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'ServerModelType',
                            reference: 'SMT-1'
                        }
                    });
                });

                model.$noPayload({ success: function(result) {
                    returnValue = result;
                }});

                expect(returnValue.get('result').isServerModel()).toBe(true);
            });

            it('will convert a return value with an obj with reference inside an array to a server model', function() {
                var returnValue;
                prepareForTest({
                    type: 'object',
                    $ref: 'woa'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'WithObjectsAndArrays',
                            anArray: [ {
                                type: 'ServerModelType',
                                reference: 'SMT-1'
                            } ]
                        }
                    });
                });

                model.$noPayload({ success: function(result) {
                    returnValue = result;
                }});

                expect(returnValue.get('result').get('anArray')[0].isServerModel()).toBe(true);
            });

            it('will convert a return value with an obj with reference inside an object to a server model', function() {
                var returnValue;
                prepareForTest({
                    type: 'object',
                    $ref: 'woa'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'WithObjectsAndArrays',
                            anObject: {
                                aProp: {
                                    type: 'ServerModelType',
                                    reference: 'SMT-1'
                                }
                            }
                        }
                    });
                });

                model.$noPayload({ success: function(result) {
                    returnValue = result;
                }});

                expect(returnValue.get('result').get('anObject').aProp.isServerModel()).toBe(true);
            });

            it('will throw an error if no return type defined, but it nevertheless returns something', function() {
                prepareForTest(undefined);
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: 'hi'
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('(return value) has a value, but it has no definition.'));
            });

            it('will throw an error if the result type doesn\'t match the return type for the operation', function() {
                prepareForTest({ type: 'string' });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: 45
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('(return value) has to be type string but is integer (45)'));
            });

            it('will throw an error if the result type doesn\'t match the return type for the operation', function() {
                prepareForTest({
                    type: 'object',
                    $ref: 'd1'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'Dummy2'
                        }
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('(return value) has to be type object/Dummy1 but is object/Dummy2'));
            });
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = model.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = model.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = model.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('$payloadObjectOperation()', function() {
        var ajaxSpy;
        var model;

        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    payload: {
                        payload: {
                            type: 'object',
                            $ref: 'o'
                        }
                    },
                    payloadWithEmbedded: {
                        payload: {
                            type: 'object',
                            $ref: 'C'
                        }
                    },
                    payloadWithCreate: {
                        payload: {
                            type: 'object',
                            $ref: 'o'
                        },
                        validateAs: 'create'
                    },
                    payloadWithUpdate: {
                        payload: {
                            type: 'object',
                            $ref: 'o'
                        },
                        validateAs: 'update'
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var otherType = {
                name: 'OtherType',
                properties: {
                    type: {
                        type: 'string',
                        required: true
                    },
                    value: {
                        type: 'integer',
                        required: true
                    },
                    createValue: {
                        type: 'string',
                        create: 'required'
                    },
                    updateValue: {
                        type: 'string',
                        update: 'required'
                    }
                }
            };
            var container = {
                name: 'ContainerType',
                properties: {
                    type: { type: 'string'},
                    embedded: {
                        type: 'object',
                        $ref: 'o',
                        required: true
                    }
                }
            };
            var yetAnotherType = {
                name: 'YetAnotherType',
                'extends': {
                    $ref: 'o'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, C: container,
                a: yetAnotherType, o: otherType, k: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$payload).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$payload).toBeDefined();
        });

        it('will reject a call when there is no reference set', function() {
            expect(function() {
                model.$payload({
                    type: 'OtherType',
                    value: 1145
                });
            }).toDxFail(new Error('$payload can not be called without a reference property set.'));
        });

        it('will reject a call when the payload is not a backbone object', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$payload({
                    type: 'OtherType',
                    value: 1145
                });
            }).toDxFail(new Error('Must call $payload with a backbone model.'));
        });

        it('will reject a call when the payload is not a compatible type', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$payload(target._newClientModel('OKResult'));
            }).toDxFail(new Error('Must call $payload with an instance of OtherType.'));
        });

        it('will call success callback with the successful result', function() {
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            var payload = target._newClientModel('OtherType');
            payload.set('value', 23);
            model.$payload(payload, {
                success: successCallback
            });

            expect(successCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(successCallback.mostRecentCall.args[0].get('type')).toEqual('OKResult');
        });

        it('will make the appropriate call given its parameters', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('OtherType');
            payload.set('value', 23);
            model.$payload(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].type).toBe('POST');
            expect(jQuery.ajax.mostRecentCall.args[0].url).toContain('somewhere/REF-1/payload');
            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"type":"OtherType","value":23}');
        });

        it('will accept a call with a subtype', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('YetAnotherType');
            payload.set('value', 23);
            model.$payload(payload);

            expect(jQuery.ajax).toHaveBeenCalled();
        });

        it('will reject a call when a required parameter is missing', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('OtherType');
            payload.set('value', undefined);

            expect(function() {
                model.$payload(payload);
            }).toDxFail(new Error('The attribute value is required to be non-null/non-undefined.'));
        });

        it('will reject a call when a required parameter in an embedded type is missing', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('ContainerType');
            payload.get('embedded').set('value', undefined);

            expect(function() {
                model.$payloadWithEmbedded(payload);
            }).toDxFail(new Error('The attribute value is required to be non-null/non-undefined.'));
        });

        it('will reject a call when a parameter marked as create:required is missing', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('OtherType');
            payload.set('value', 23);

            expect(function() {
                model.$payloadWithCreate(payload);
            }).toDxFail(new Error('The attribute createValue is required to be non-null/non-undefined.'));
        });

        it('will accept a call without a payload when the schema says payload is not required', function() {
            var opt = {
                name: 'WithOptional',
                root: '/someRoot',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    }
                },
                operations: {
                    optionalPayload: {
                        payload: {
                            type: 'object',
                            $ref: 'y',
                            required: false
                        }
                    }
                }
            };
            var yetAnotherType = {
                name: 'YetAnotherType'
            };
            var schemas = dx.core.data._prepareSchemas({o: opt, y: yetAnotherType});
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('WithOptional');
            model.set('reference', 'REF-1');

            model.$optionalPayload();

            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(null);
        });

        it('will accept a call with a payload when the schema says payload is not required', function() {
            var opt = {
                name: 'WithOptional',
                root: '/someRoot',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    }
                },
                operations: {
                    optionalPayload: {
                        payload: {
                            type: 'object',
                            $ref: 'y',
                            required: false
                        }
                    }
                }
            };
            var yetAnotherType = {
                name: 'YetAnotherType',
                properties: {
                    type: {
                        type: 'string',
                        required: true
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({o: opt, y: yetAnotherType});
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('WithOptional');
            model.set('reference', 'REF-1');

            model.$optionalPayload(target._newClientModel('YetAnotherType'));

            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual('{"type":"YetAnotherType"}');
        });

        it('will send payload with ceate:optional parameters', function() {
            var opt = {
                name: 'WithOptional',
                root: '/someRoot',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    }
                },
                operations: {
                    payloadWithCreateOptional: {
                        payload: {
                            type: 'object',
                            $ref: 'y'
                        }
                    }
                }
            };
            var yetAnotherType = {
                name: 'YetAnotherType',
                properties: {
                    type: {
                        type: 'string',
                        required: true
                    },
                    co: {
                        type: 'string',
                        create: 'optional'
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({'o': opt, 'y': yetAnotherType});
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('WithOptional');
            model.set('reference', 'REF-1');
            var payload = target._newClientModel('YetAnotherType');
            payload.set('co', 'create:optional');

            model.$payloadWithCreateOptional(payload);

            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual('{"type":"YetAnotherType","co":"create:optional"}');
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var payload = target._newClientModel('OtherType');
                payload.set('value', 23);
                var promise = model.$payload(payload);
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var payload = target._newClientModel('OtherType');
                payload.set('value', 23);
                var promise = model.$payload(payload);
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var payload = target._newClientModel('OtherType');
                payload.set('value', 23);
                var promise = model.$payload(payload);
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('$noParametersObjectOperation()', function() {
        var ajaxSpy;
        var model;

        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    noParameters: {}
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, o: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$noParameters).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$noParameters).toBeDefined();
        });

        it('can be called with no parameters', function() {
            model.set('reference', 'REF-1');
            model.$noParameters();
            expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/REF-1/noParameters');
            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
        });

        it('will throw an error if invoked with no reference', function() {
            expect(function() {
                model.$noParameters();
            }).toDxFail(new Error('$noParameters can not be called without a reference property set.'));
        });

        it('will call success callback with the successful result', function() {
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            model.$noParameters({
                success: successCallback
            });

            expect(successCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(successCallback.mostRecentCall.args[0].get('type')).toEqual('OKResult');
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = model.$noParameters();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = model.$noParameters();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = model.$noParameters();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('$parametersObjectOperation()', function() {
        var ajaxSpy;
        var model;

        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    parameters: {
                        parameters: {
                            a: {
                                type: 'string'
                            },
                            c: {
                                type: 'boolean'
                            }
                        }
                    },
                    sendAllTypes: {
                        parameters: {
                            requiredStringVal : {
                                type: 'string',
                                required: true
                            },
                            nullVal: {
                                type: 'null'
                            },
                            numVal: {
                                type: 'number'
                            },
                            intVal: {
                                type: 'integer'
                            },
                            boolVal: {
                                type: 'boolean'
                            },
                            objRefVal: {
                                type: 'string',
                                format: 'objectReference'
                            },
                            dateVal: {
                                type: 'string',
                                format: 'date'
                            },
                            enumVal: {
                                type: 'string',
                                'enum': ['VALUE1', 'VALUE2', 'VALUE3']
                            }
                        }
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, o: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$parameters).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$parameters).toBeDefined();
        });

        it('will call success callback with the successful result', function() {
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            model.$parameters({}, {
                success: successCallback
            });

            expect(successCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(successCallback.mostRecentCall.args[0].get('type')).toEqual('OKResult');
        });

        it('it will pass its parameters to the call to the backend', function() {
            model.set('reference', 'REF-1');

            model.$parameters({ a: 'b', c: true});

            expect(jQuery.ajax.mostRecentCall.args[0].type).toBe('GET');
            expect(jQuery.ajax.mostRecentCall.args[0].url).toContain('somewhere/REF-1/parameters');
            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual({ a: 'b', c: true});
        });

        it('will throw an error if invoked without a reference', function() {
            expect(function() {
                model.$parameters({ a: 'b', c: true});
            }).toDxFail(new Error('$parameters can not be called without a reference property set.'));
        });

        it('will throw an error if passed a value other than an object as its parameters', function() {
            model.set('reference', 'REF-1');
            expect(function() {
                model.$parameters('bogus');
            }).toDxFail(new Error('$parameters must be passed a (possibly empty) hash of parameters.'));
        });

        it('will throw an error if called with an undefined parameter', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$parameters({bogus: true});
            }).toDxFail(new Error('bogus is not a valid parameter name.'));
        });

        it('will throw an error if called with a parameter with an undefined value', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$sendAllTypes({requiredStringVal: undefined});
            }).toDxFail(
                new Error('Can not send a request with an undefined parameter (requiredStringVal is undefined).'));
        });

        it('will have no problems if invoked with no parameters', function() {
            model.set('reference', 'REF-1');

            model.$parameters();

            expect(jQuery.ajax.mostRecentCall.args[0].url).toContain('somewhere/REF-1/parameters');
            expect(jQuery.ajax.mostRecentCall.args[0].data).toBeUndefined();
        });

        it('throws an error if a required parameter is not included', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$sendAllTypes({ boolVal: true });
            }).toDxFail(new Error('requiredStringVal is required, but has not been passed.'));
        });

        it('accepts all param types', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'one',
                    boolVal: false,
                    intVal: 34,
                    numVal: 67.6,
                    nullVal: null,
                    objRefVal: 'HI THERE',
                    dateVal: new Date()
                });
            }).not.toDxFail();
        });

        it('throws an error if a parameter type doesn\'t match the specified type', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: true
                });
            }).toDxFail(new Error('requiredStringVal has to be type string but is boolean (true)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    boolVal: 1
                });
            }).toDxFail(new Error('boolVal has to be type boolean but is integer (1)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    numVal: 'hi'
                });
            }).toDxFail(new Error('numVal has to be type number but is string ("hi")'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    numVal: 12
                });
            }).not.toDxFail(new Error('numVal has to be type number but is integer (12)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    intVal: 12.12
                });
            }).toDxFail(new Error('intVal has to be type integer but is number (12.12)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    nullVal: true
                });
            }).toDxFail(new Error('nullVal has to be type null but is boolean (true)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    dateVal: true
                });
            }).toDxFail(new Error('dateVal has to be type date but is boolean (true)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    enumVal: 'INVALID_VALUE'
                });
            }).toDxFail(new Error('enumVal is an enum and has to be one of ["VALUE1","VALUE2","VALUE3"] but is' +
                ' "INVALID_VALUE"'));
        });

        it('accepts both string and date values for a date parameter', function() {
            model.set('reference', 'REF-1');
            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    dateVal: '2014-01-01T12:34:56.000Z'
                });
            }).not.toDxFail();

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    dateVal: new Date()
                });
            }).not.toDxFail();
        });

        it('it will pass a date object as a string', function() {
            model.set('reference', 'REF-1');
            var newDate = new Date();
            newDate.setUTCFullYear(2013, 11, 11);
            newDate.setUTCHours(10, 9, 8, 765);

            model.$sendAllTypes({
                requiredStringVal: 'required',
                dateVal: newDate
            });

            expect(jQuery.ajax.mostRecentCall.args[0].data).
                toEqual({ requiredStringVal: 'required', dateVal: '2013-12-11T10:09:08.765Z'});
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = model.$parameters({});
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = model.$parameters({});
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = model.$parameters({});
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('(sending required parameters)', function() {
        function prepareForTest(schema1, schema2) {
            target = {};
            var testType = {
                name: 'TestType',
                root: '/somewhere',
                properties: {
                    reference: {
                        type: 'string'
                    }
                },
                operations: {
                    doit: {
                        payload: {
                            type: 'object',
                            $ref: 'one'
                        }
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({one: schema1, two: schema2, s: testType});
            dx.core.data._generateModelConstructors(schemas, target);
            return target._newClientModel('TestType');
        }

        it('will report an error if a required parameter is not set', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'string',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired'
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            expect(function() {
                model.$doit(payload);
            }).toDxFail('The attribute first is required to be non-null/non-undefined.');
        });

        it('will report an error if a required parameter in an embedded object is not set', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'string',
                        required: true
                    },
                    embedded: {
                        type: 'object',
                        $ref: 'two',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                    first: {
                        type: 'string',
                        required: true
                    }
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');
            payload.set('first', 'hello');

            expect(function() {
                model.$doit(payload);
            }).toDxFail('The attribute first is required to be non-null/non-undefined.');
        });

        it('will send a null value if the property type is "null"', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'null',
                        required: true
                    },
                    embedded: {
                        type: 'object',
                        $ref: 'two',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                    first: {
                        type: 'null',
                        required: true
                    }
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"first":null,"embedded":{"first":null}}');
        });

        it('will not send non-required properties if they are undefined', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'integer',
                        required: true
                    },
                    second: {
                        type: 'string',
                        required: false
                    },
                    third: {
                        type: 'integer'
                    },
                    embedded: {
                        type: 'object',
                        $ref: 'two',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                    first: {
                        type: 'integer',
                        required: true
                    },
                    second: {
                        type: 'string',
                        required: false
                    },
                    third: {
                        type: 'integer'
                    }
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            payload.set({ first: 1, third: undefined, embedded: { first: 11, third: undefined } });

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"first":1,"embedded":{"first":11}}');
        });

        it('will send required true and false props if they are non-null/non-undefined', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'integer',
                        required: true
                    },
                    second: {
                        type: 'integer',
                        required: false
                    },
                    third: {
                        type: 'integer'
                    },
                    embedded: {
                        type: 'object',
                        $ref: 'two',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                    first: {
                        type: 'integer',
                        required: true
                    },
                    second: {
                        type: 'integer',
                        required: false
                    },
                    third: {
                        type: 'integer'
                    }
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            payload.set({
                first: 1,
                second: 2,
                third: 3,
                embedded: {
                    first: 11,
                    second: 12,
                    third:13
                }
            });

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).
                toEqual('{"first":1,"second":2,"third":3,"embedded":{"first":11,"second":12,"third":13}}');
        });

        it('will send non-required properties if they are defined', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    third: {
                        type: 'integer'
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            payload.set({ third: 3 });

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"third":3}');
        });

        it('will not send non-required properties if they are undefined', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    third: {
                        type: 'integer'
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            payload.set({ third: undefined });

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{}');
        });
    });

    describe('$sub_operations()', function() {
        var ajaxSpy;
        var model;

        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    noPayload: {
                        payload: {},
                        childPayload: {
                            payload: {}
                        }
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    result: {
                        type: 'string'
                    },
                    type: {
                        type: 'string'
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, ok: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$noPayload_childPayload).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$noPayload_childPayload).toBeDefined();
        });

        it('can be called with no parameters', function() {
            model.set('reference', 'REF-1');
            model.$noPayload_childPayload();
            expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/REF-1/noPayload/childPayload');
            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = model.$noPayload_childPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = model.$noPayload_childPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = model.$noPayload_childPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('$rootOperations()', function() {
        var ajaxSpy;

        beforeEach(function() {
            var schema = {
                name: 'RootType',
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                rootOperations: {
                    noPayload: {
                        payload: {},
                        childPayload: {
                            payload: {}
                        }
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            };
            target = {};
            ajaxSpy = spyOn(jQuery, 'ajax');
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, ok: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._generateModelConstructors(schemas, target);
        });

        it('is created when specified in the schema', function() {
            expect(target.rootOps.RootType.$noPayload).toBeDefined();
        });

        it('is not created for child types', function() {
            expect(target.rootOps.ChildType).not.toBeDefined();
        });

        it('is created on child operations', function() {
            expect(target.rootOps.RootType.$noPayload_childPayload).toBeDefined();
        });

        it('can be called with no parameters', function() {
            target.rootOps.RootType.$noPayload();
            expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/noPayload');
            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
        });

        describe('on singletons', function() {
            beforeEach(function() {
                var schema = {
                    name: 'ASingleton',
                    singleton: true,
                    root: '/a/singleton/url',
                    properties: { reference: { type: 'string' } },
                    rootOperations: {
                        rootOp: {
                            payload: {}
                        }
                    }
                };
                target = {};
                var schemas = dx.core.data._prepareSchemas({ t: schema });
                dx.core.data._generateModelConstructors(schemas, target);
            });

            it('is not put on rootOps if it is defined on a singleton', function() {
                expect(target.rootOps.ASingleton).not.toBeDefined();
            });

            it('is put on singleton model if it is defined on a singleton schema', function() {
                expect(target._newClientModel('ASingleton').$rootOp).toBeDefined();
            });

            it('can be called with no parameters', function() {
                var model = target._newClientModel('ASingleton');

                model.$rootOp();
                expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/a/singleton/url/rootOp');
            });
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = target.rootOps.RootType.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = target.rootOps.RootType.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = target.rootOps.RootType.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('_getRootType()', function() {
        var target = {};

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

            var parsedSchemas = dx.core.data._prepareSchemas({
                g: grandparent,
                p: parent,
                c: child,
                n: noRoot
            });
            dx.core.data._initCache(target);
            dx.core.data._initFilters(target);
            dx.core.data._generateModelConstructors(parsedSchemas, target);
        });

       it('throws an error when called with no parameter', function() {
            expect(function() {
                target._getRootType();
            }).toDxFail(new Error('Must call with a type name.'));
       });

       it('throws an error when asked for a type that doesn\'t exist', function() {
            expect(function() {
                target._getRootType('BogusType');
            }).toDxFail(new Error('BogusType is not a known type name.'));
       });

       it('returns undefined when asked for the collection type of a type without a collection parent', function() {
           expect(target._getRootType('NoRoot')).toBeUndefined();
       });

       it('returns grandparent name when child asked about', function() {
           expect(target._getRootType('Child')).toBe('GrandParent');
       });

       it('returns grandparent name when parent asked about', function() {
           expect(target._getRootType('Parent')).toBe('GrandParent');
       });

       it('returns grandparent name when grandparent asked about', function() {
           expect(target._getRootType('GrandParent')).toBe('GrandParent');
       });
    });

    describe('_dxFetch()', function() {
        var model;

        beforeEach(function() {
            target = {};
            var parent = {
                root: '/whatever',
                name: 'ParentType',
                properties: { reference: { type: 'string' } }
            };
            var schemas = dx.core.data._prepareSchemas({
                p: parent,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema
            });
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('ParentType');
            model._dxIsReady = false;   // fake it so it looks enough like a server model
        });

        it('has no problems if an error handler isn\'t specified', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 200,
                    statusText: 'hi',
                    responseText: 'foo'
                });
            });

            expect(function() {
                model._dxFetch();
            }).not.toThrow();
        });

        it('serializes concurrent requests', function() {
            var deferred = [];
            var ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(function() {
                deferred = $.Deferred();
                return deferred.promise();
            });

            model._dxFetch();
            dx.test.assert(ajaxSpy.calls.length).toBe(1);

            var options = ajaxSpy.calls[0].args[0];

            // This fetch should be pass the value of the initial query
            var skippedFetch = jasmine.createSpy('skipped');
            model._dxFetch({
                success: skippedFetch
            });

            // This fetch should be serialized
            var serializedFetch = jasmine.createSpy('serialized');
            model._dxFetch({
                error: serializedFetch
            });

            // first request completes
            options.success({
                type: 'OKResult',
                result: {
                    reference: 'REF_1'
                }
            });
            deferred.resolve();

            expect(model.get('reference')).toBe('REF_1');
            expect(skippedFetch).toHaveBeenCalled();
            expect(skippedFetch.calls[0].args[0].get('reference')).toBe('REF_1');
            expect(serializedFetch).not.toHaveBeenCalled();
            expect(ajaxSpy.calls.length).toBe(2);

            options = ajaxSpy.calls[1].args[0];
            options.error({});
            deferred.resolve();
            expect(model.get('reference')).toBe('REF_1');
            expect(serializedFetch.calls[0].args[0].get('error')).not.toBeUndefined();

            model._dxFetch();
            expect(ajaxSpy.calls.length).toBe(3);

            options = ajaxSpy.calls[2].args[0];
            options.success({
                type: 'OKResult',
                result: {
                    reference: 'REF_2'
                }
            });
            deferred.resolve();
            expect(model.get('reference')).toBe('REF_2');
        });

        it('allows a dxFetch to be issued in a dxFetch callback', function() {
            var deferred = [];
            var ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(function() {
                deferred = $.Deferred();
                return deferred.promise();
            });

            model._dxFetch({
                success: function() {
                    model._dxFetch();
                }
            });
            var options = ajaxSpy.calls[0].args[0];

            // first request completes
            options.success({
                type: 'OKResult',
                result: {
                    reference: 'REF_1'
                }
            });
            deferred.resolve();

            // A new request must be pending
            expect(ajaxSpy.calls.length).toBe(2);
        });

        it('reports an status200/ErrorResult as an error with the ErrorResult model', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            model.on('error', errorSpy);
            model._dxFetch();

            expect(errorSpy).toHaveBeenCalled();
            expect(errorSpy.mostRecentCall.args[0]).toBe(model);
            expect(errorSpy.mostRecentCall.args[1].get('type')).toEqual('ErrorResult');
        });

        it('reports an status200/ErrorResult with no error handler calls global handler', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            spyOn(target, 'reportErrorResult');

            model._dxFetch();

            expect(target.reportErrorResult).toHaveBeenCalled();
        });

        it('reports an status200/ErrorResult with no error handler calls global handler only once', function() {
            var deferred = [];
            var ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(function() {
                deferred = $.Deferred();
                return deferred.promise();
            });
            spyOn(target, 'reportErrorResult');
            var errorSpy = jasmine.createSpy('error');

            // First 3 requests are resolved with the same ajax response
            model._dxFetch();
            model._dxFetch({
                error: errorSpy
            });
            model._dxFetch();
            model._dxFetch();

            var options = ajaxSpy.calls[0].args[0];
            options.success({
                type: 'ErrorResult'
            });
            deferred.resolve();

            expect(target.reportErrorResult.calls.length).toBe(1);
            expect(errorSpy).toHaveBeenCalled();

        });

        it('does not report a status200/ErrorResult when suppresErrorHandler is set', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            spyOn(target, 'reportErrorResult');

            model._dxFetch({
                suppressDefaultErrorHandler: true
            });

            expect(target.reportErrorResult).not.toHaveBeenCalled();
        });

        it('reports an status404/ErrorResult as an error with the ErrorResult model', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: '{"type":"ErrorResult"}'
                }, 'error', 'whatever');
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            model._dxFetch({
                error: errorSpy
            });

            expect(errorSpy).toHaveBeenCalled();
            expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
        });

        it('does not report a status404/ErrorResult when suppresErrorHandler is set', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: '{"type":"ErrorResult"}'
                }, 'error', 'whatever');
            });
            spyOn(target, 'reportErrorResult');

            model._dxFetch({
                suppressDefaultErrorHandler: true
            });

            expect(target.reportErrorResult).not.toHaveBeenCalled();
        });

        it('triggers an error event if an error occurs', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                });
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            model._dxFetch({
                error: errorSpy
            });

            expect(errorSpy).toHaveBeenCalled();
        });

        it('triggers an "error" event if this gets back a 200/ErrorResult', function() {
            var errorSpy = jasmine.createSpy('error');
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            model.on('error', errorSpy);
            model._dxFetch();

            expect(errorSpy).toHaveBeenCalled();
        });

        it('triggers an "error" event at any point after the error occurs', function() {
            var errorSpy = jasmine.createSpy('error');
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            model._dxFetch();

            model.on('error', errorSpy);
            expect(errorSpy).toHaveBeenCalled();
        });

        it('removes ready event callbacks at any point after the error occurs', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            model._dxFetch();

            model.on('ready', function() {});

            expect(model._events).toBe(undefined);
        });

        it('removes error event callbacks at any point after the error occurs', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            model._dxFetch();

            model.on('error', function() {});

            expect(model._events.error).toBe(undefined);
        });

        it('triggers no badReference event if annon- 404 error occurs', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 403,
                    getResponseHeader: function() {
                        return 'text/html';
                    },
                    responseText: '<html></html>'
                }, 'error', 'whatever');
            });
            var badReferenceSpy = jasmine.createSpy('badReferenceSpy');
            model.on('badReference', badReferenceSpy);

            model._dxFetch();

            expect(badReferenceSpy).not.toHaveBeenCalled();
        });

        it('reports an status404/non-ErrorResult as an error with an ErrorResult model', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text';
                    },
                    statusText: 'OOPS',
                    responseText: '<html><body>Bogus, man</body></html>'
                }, 'error', 'whatever');
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            model._dxFetch({
                error: errorSpy
            });

            expect(errorSpy).toHaveBeenCalled();
            expect(errorSpy.mostRecentCall.args[0].get('error').get('details')).toEqual('Communication Error');
            expect(errorSpy.mostRecentCall.args[0].get('error').get('commandOutput')).
                toEqual('HTTP Error: 404\nStatus text: OOPS\nResponse text: <html><body>Bogus, man</body></html>');
        });

        it('triggers a badReference event if an 404 error occurs', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text/html';
                    },
                    responseText: '<html></html>'
                }, 'error', 'whatever');
            });
            var badReferenceSpy = jasmine.createSpy('badReferenceSpy');
            model.on('badReference', badReferenceSpy);

            model._dxFetch();

            expect(badReferenceSpy).toHaveBeenCalled();
        });
    });

    describe('ready event', function() {
        var model;
        var readySpy;

        beforeEach(function() {
            target = {};
            var type = {
                root: '/whatever',
                name: 'AType',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    },
                    embedded: {
                        type: 'object',
                        $ref: 'e'
                    }
                }
            };
            var embedded = {
                name: 'Embedded'
            };
            var schemas = dx.core.data._prepareSchemas({'p': type, 'e': embedded});
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('AType');
            readySpy = jasmine.createSpy('readySpy');
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'OKResult',
                    result: {
                        type: 'AType'
                    }
                });
            });
        });

        it('is always triggered on client models', function() {
            model.on('ready', readySpy);

            expect(readySpy).toHaveBeenCalled();
        });

        it('passes the model as the argument to the handler', function() {
            model.on('ready', readySpy);

            expect(readySpy.mostRecentCall.args[0]).toBe(model);
        });

        it('is always triggered on client models, even when mixed with other events', function() {
            model.on('ready change', readySpy);

            expect(readySpy).toHaveBeenCalled();
        });

        it('is always triggered on embedded client models', function() {
            var emb = model.get('embedded');
            emb.on('ready', readySpy);

            expect(readySpy).toHaveBeenCalled();
        });

        it('is not triggered on an un-fetched server model', function() {
            model = target._newServerModel('AType');
            model.on('ready', readySpy);

            expect(readySpy).not.toHaveBeenCalled();
        });

        it('is not triggered on an un-fetched embedded server model', function() {
            model = target._newServerModel('AType');
            var emb = model.get('embedded');
            emb.on('ready', readySpy);

            expect(readySpy).not.toHaveBeenCalled();
        });

        it('is triggered on a server model when it is fetched', function() {
            model = target._newServerModel('AType');
            model.on('ready', readySpy);
            model._dxFetch();

            expect(readySpy).toHaveBeenCalled();
        });

        it('is removed after having been triggered when it is fetched', function() {
            model = target._newServerModel('AType');
            model.on('ready', function() {});
            model._dxFetch();

            expect(model._events.ready).toBe(undefined);
        });

        it('removes error callbacks after having been triggered when it is fetched', function() {
            model = target._newServerModel('AType');
            model.on('error', function() {});
            model._dxFetch();

            expect(model._events.error).toBe(undefined);
        });

        it('passes the model as the argument to the handler after a fetch', function() {
            model = target._newServerModel('AType');
            model.on('ready', readySpy);
            model._dxFetch();

            expect(readySpy.mostRecentCall.args[0]).toBe(model);
        });

        it('is triggered on an embedded server model when it is fetched', function() {
            model = target._newServerModel('AType');
            var emb = model.get('embedded');
            emb.on('ready', readySpy);
            model._dxFetch();

            expect(readySpy).toHaveBeenCalled();
        });

        it('is triggered on a server model after it has been fetched', function() {
            model = target._newServerModel('AType');
            model._dxFetch();

            model.on('ready', readySpy);

            expect(readySpy).toHaveBeenCalled();
        });

        it('is removed on a server model after it has been fetched', function() {
            model = target._newServerModel('AType');
            model._dxFetch();

            model.on('ready', function() {});

            expect(model._events.ready).toBe(undefined);
        });

        it('is triggered on an embedded server model after it has been fetched', function() {
            model = target._newServerModel('AType');
            var emb = model.get('embedded');
            model._dxFetch();

            emb.on('ready', readySpy);

            expect(readySpy).toHaveBeenCalled();
        });

    });

    describe('error event', function() {
        var model;
        var errorSpy;

        beforeEach(function() {
            target = {};
            var type = {
                root: '/whatever',
                name: 'AType',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({
                p: type,
                o: dx.test.dataMocks.okResultSchema,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                err: dx.test.dataMocks.errorResultSchema
            });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('AType');
            errorSpy = jasmine.createSpy('errorSpy');
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'OKResult',
                    result: {
                        type: 'AType'
                    }
                });
            });
        });

        it('is not triggered on an un-fetched server model', function() {
            model = target._newServerModel('AType');
            model.on('error', errorSpy);

            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('is not triggered on a client model', function() {
            model = target._newClientModel('AType');
            model.on('error', errorSpy);

            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('is not triggered on a server model when it is successfully fetched', function() {
            model = target._newServerModel('AType');
            model.on('error', errorSpy);
            model._dxFetch();

            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('is triggered on a server model when it is not successfully fetched', function() {
            jQuery.ajax.andCallFake(function(options) {
                options.error({
                    type: 'ErrorResult'
                });
            });
            model = target._newServerModel('AType');
            model.on('error', errorSpy);
            model._dxFetch();

            expect(errorSpy).toHaveBeenCalled();
        });

        it('is removed after having been triggered when it is fetched', function() {
            jQuery.ajax.andCallFake(function(options) {
                options.error({
                    type: 'ErrorResult'
                });
            });
            model = target._newServerModel('AType');
            model.on('error', function() {});
            model._dxFetch();

            expect(model._events.error).toBe(undefined);
        });

        it('removes ready callbacks after having been triggered when it is fetched', function() {
            jQuery.ajax.andCallFake(function(options) {
                options.error({
                    type: 'ErrorResult'
                });
            });
            model = target._newServerModel('AType');
            model.on('ready', function() {});
            model._dxFetch();

            expect(model._events.ready).toBe(undefined);
        });

        it('will not be triggered after a second fetch if the first fails, but the next one succeeds', function() {
            jQuery.ajax.andCallFake(function(options) {
                options.error({
                    type: 'ErrorResult'
                });
            });
            model = target._newServerModel('AType');
            model._dxFetch();

            jQuery.ajax.andCallFake(function(options) {
                options.success({
                    type: 'OKResult',
                    result: {
                        type: 'AType'
                    }
                });
            });
            model._dxFetch();

            model.on('error', errorSpy);
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('passes the model as the first argument to the handler', function() {
            jQuery.ajax.andCallFake(function(options) {
                options.error({
                    type: 'ErrorResult'
                });
            });
            model = target._newServerModel('AType');
            model.on('error', errorSpy);
            model._dxFetch();

            expect(errorSpy.mostRecentCall.args[0]).toBe(model);
        });

        it('passes an error result as the second argument to the handler', function() {
            jQuery.ajax.andCallFake(function(options) {
                options.error({
                    type: 'ErrorResult'
                });
            });
            model = target._newServerModel('AType');
            model.on('error', errorSpy);
            model._dxFetch();

            expect(errorSpy.mostRecentCall.args[1].get('type')).toBe('ErrorResult');
        });
    });
});

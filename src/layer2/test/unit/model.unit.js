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
/*global Backbone, $ */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');

var schemaStuff = require('../../../layer1/schema.js');
var initCache = require('../../cache.js');
var generateModelConstructors = require('../../model.js');
var CORE_SCHEMAS = require('../../../layer3/test/shared/coreSchemas.js');

describe('generateModelConstructors', function() {
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

            var schemas = schemaStuff.prepareSchemas({t: type});
            generateModelConstructors(schemas, target);

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

            var schemas = schemaStuff.prepareSchemas({t: type});
            generateModelConstructors(schemas, target);
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

            var schemas = schemaStuff.prepareSchemas({t: schema, s: schema2});
            generateModelConstructors(schemas, target);
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
            var schemas = schemaStuff.prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType,
                referenceType: simpleReferenceType
            });
            generateModelConstructors(schemas, target);

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

            var schemas = schemaStuff.prepareSchemas({t: schema});
            initCache(target);
            generateModelConstructors(schemas, target);

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
            var ajaxSpy = spyOn($, 'ajax');
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

            var schemas = schemaStuff.prepareSchemas({t: schema});
            initCache(target);
            generateModelConstructors(schemas, target);
            model = target._newClientModel('TypeWithReference');
            model.set('sibling', 'SIBLING-1');

            var ajaxSpy = spyOn($, 'ajax');
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

            var schemas = schemaStuff.prepareSchemas({t: schema});
            initCache(target);
            generateModelConstructors(schemas, target);
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

    // Test Backbone's own escape() behavior, just so we notice if something changes.
    describe('escape()', function() {
        var model;
        beforeEach(function() {
            target = {};
            var schemas = schemaStuff.prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType,
                referenceType: simpleReferenceType
            });
            initCache(target);
            generateModelConstructors(schemas, target);

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
            var ajaxSpy = spyOn($, 'ajax');
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

            var schemas = schemaStuff.prepareSchemas({t: schema});
            generateModelConstructors(schemas, target);

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
            var schemas = schemaStuff.prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType,
                referenceType: simpleReferenceType
            });
            generateModelConstructors(schemas, target);

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
            var schemas = schemaStuff.prepareSchemas({t: allTypes, simpleEmbeddedType: simpleEmbeddedType});
            generateModelConstructors(schemas, target);

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
            var schemas = schemaStuff.prepareSchemas({t: {}});
            generateModelConstructors(schemas, target);
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
            var schemas = schemaStuff.prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType,
                referenceType: simpleReferenceType
            });
            generateModelConstructors(schemas, target);
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

            var schemas = schemaStuff.prepareSchemas({t: type});
            generateModelConstructors(schemas, target);
            model = target._newClientModel('TestType');
        });

        it('returns an empty hash if given no response', function() {
            spyOn(dxLog, 'warn');

            expect(model.parse()).toBeUndefined();
        });

        it('returns an empty hash if given no response', function() {
            spyOn(dxLog, 'warn');

            expect(model.parse()).toBeUndefined();
        });

        it('reports a warning if asked to parse something we dont know about', function() {
            spyOn(dxLog, 'warn');

            expect(model.parse({
                type: 'bogusness'
            })).toBeUndefined();
            expect(dxLog.warn).toHaveBeenCalled();
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
            var schemas = schemaStuff.prepareSchemas({t: allTypes, simpleEmbeddedType: simpleEmbeddedType});
            generateModelConstructors(schemas, target);

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
            var schemas = schemaStuff.prepareSchemas({p: parent, c: child, r: another});
            generateModelConstructors(schemas, target);
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
            var schemas = schemaStuff.prepareSchemas({p: parent});
            generateModelConstructors(schemas, target);
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
            var schemas = schemaStuff.prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType
            });
            generateModelConstructors(schemas, target);
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
            var schemas = schemaStuff.prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType
            });
            generateModelConstructors(schemas, target);
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
            var schemas = schemaStuff.prepareSchemas({
                t: allTypes,
                simpleEmbeddedType: simpleEmbeddedType
            });
            generateModelConstructors(schemas, target);
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

            var parsedSchemas = schemaStuff.prepareSchemas({
                g: grandparent,
                p: parent,
                c: child,
                n: noRoot
            });
            initCache(target);
            generateModelConstructors(parsedSchemas, target);
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
            var schemas = schemaStuff.prepareSchemas(_.extend({
                p: parent
            }, CORE_SCHEMAS));
            generateModelConstructors(schemas, target);
            model = target._newClientModel('ParentType');
            model._dxIsReady = false;   // fake it so it looks enough like a server model
        });

        it('has no problems if an error handler isn\'t specified', function() {
            spyOn($, 'ajax').andCallFake(function(options) {
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
            var ajaxSpy = spyOn($, 'ajax').andCallFake(function() {
                deferred = $.Deferred();
                return deferred.promise();
            });

            model._dxFetch();
            assert(ajaxSpy.calls.length).toBe(1);

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
            var ajaxSpy = spyOn($, 'ajax').andCallFake(function() {
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
            spyOn($, 'ajax').andCallFake(function(options) {
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
            spyOn($, 'ajax').andCallFake(function(options) {
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
            var ajaxSpy = spyOn($, 'ajax').andCallFake(function() {
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
            spyOn($, 'ajax').andCallFake(function(options) {
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
            spyOn($, 'ajax').andCallFake(function(options) {
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
            spyOn($, 'ajax').andCallFake(function(options) {
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
            spyOn($, 'ajax').andCallFake(function(options) {
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
            spyOn($, 'ajax').andCallFake(function(options) {
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
            spyOn($, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            model._dxFetch();

            model.on('error', errorSpy);
            expect(errorSpy).toHaveBeenCalled();
        });

        it('removes ready event callbacks at any point after the error occurs', function() {
            spyOn($, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            model._dxFetch();

            model.on('ready', function() {});

            expect(model._events).toBe(undefined);
        });

        it('removes error event callbacks at any point after the error occurs', function() {
            spyOn($, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            model._dxFetch();

            model.on('error', function() {});

            expect(model._events.error).toBe(undefined);
        });

        it('triggers no badReference event if annon- 404 error occurs', function() {
            spyOn($, 'ajax').andCallFake(function(options) {
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
            spyOn($, 'ajax').andCallFake(function(options) {
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
            expect(errorSpy.mostRecentCall.args[0].get('error').get('commandOutput'))
                .toEqual('HTTP Error: 404\nStatus text: OOPS\nResponse text: <html><body>Bogus, man</body></html>');
        });

        it('triggers a badReference event if an 404 error occurs', function() {
            spyOn($, 'ajax').andCallFake(function(options) {
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
            var schemas = schemaStuff.prepareSchemas({p: type, e: embedded});
            initCache(target);
            generateModelConstructors(schemas, target);
            model = target._newClientModel('AType');
            readySpy = jasmine.createSpy('readySpy');
            spyOn($, 'ajax').andCallFake(function(options) {
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
            var schemas = schemaStuff.prepareSchemas(_.extend({
                p: type
            }, CORE_SCHEMAS));
            initCache(target);
            generateModelConstructors(schemas, target);
            model = target._newClientModel('AType');
            errorSpy = jasmine.createSpy('errorSpy');
            spyOn($, 'ajax').andCallFake(function(options) {
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
            $.ajax.andCallFake(function(options) {
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
            $.ajax.andCallFake(function(options) {
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
            $.ajax.andCallFake(function(options) {
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
            $.ajax.andCallFake(function(options) {
                options.error({
                    type: 'ErrorResult'
                });
            });
            model = target._newServerModel('AType');
            model._dxFetch();

            $.ajax.andCallFake(function(options) {
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
            $.ajax.andCallFake(function(options) {
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
            $.ajax.andCallFake(function(options) {
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

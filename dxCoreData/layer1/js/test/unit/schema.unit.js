/*
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Copyright (c) 2013, 2015 by Delphix. All rights reserved.
 */

/*global xit */
/*eslint-env jasmine */
/*global dx */

'use strict';

describe('dx.core.data._prepareSchemas', function() {

    it('throws an error if no schema is provided', function() {
        expect(function() {
            dx.core.data._prepareSchemas();
        }).toDxFail(new Error('Must provide a schemas object.'));
    });

    it('throws an error if queryParamAnnotations are provided but are not an object', function() {
        expect(function() {
            dx.core.data._prepareSchemas({}, 'not an object');
        }).toDxFail(new Error('queryParamAnnotations is defined but not an object.'));
    });

    it('makes a copy of schema objects if copySchemas is true', function() {
        var schema = {
            'name': 'aSchema'
        };

        var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema}, {}, true);

        expect(newSchemas.aSchema).not.toBe(schema);
    });

    xit('does not make a copy of schema objects if copySchemas is false', function() {
        var schema = {
            'name': 'aSchema'
        };

        var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema}, {}, false);

        expect(newSchemas.aSchema).toBe(schema);
    });

    describe('preserveUneeded', function() {
        it('deletes schema descriptions if false', function() {
            var schema = {
                name: 'aSchema',
                description: 'This is a description'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema}, {}, false, false);

            expect(newSchemas.aSchema.description).toBeUndefined();
        });

        it('preserves schema descriptions if true', function() {
            var schema = {
                name: 'aSchema',
                description: 'This is a description'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema}, {}, false, true);

            expect(newSchemas.aSchema.description).toBe('This is a description');
        });

        it('deletes property descriptions if false', function() {
            var schema = {
                name: 'aSchema',
                properties: {
                    first: {
                        description: 'This is a description'
                    }
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema}, {}, false, false);

            expect(newSchemas.aSchema.properties.first.description).toBeUndefined();
        });

        it('preserves property descriptions if true', function() {
            var schema = {
                name: 'aSchema',
                properties: {
                    first: {
                        description: 'This is a description'
                    }
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema}, {}, false, true);

            expect(newSchemas.aSchema.properties.first.description).toBe('This is a description');
        });
    });

    describe('_dxSchemas name', function() {
        it('creates a schema named after the schema name', function() {
            var schema = {
                'name': 'aSchema'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema});

            expect(newSchemas.aSchema).toBeDefined();
        });

        it('creates a schema named after the schemaKey, if no name is present in the schema', function() {
            var schema = {
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema});

            expect(newSchemas.aKey).toBeDefined();
        });

        it('removes \'s and ".json" from the schemaKey and replaces - with _\'s in the schema name', function() {
            var schema = {
            };

            var newSchemas = dx.core.data._prepareSchemas({'/a-Key-name.json' : schema});

            expect(newSchemas.a_Key_name).toBeDefined();
        });
    });

    describe('schema.name', function() {
        it('is set to the name provided in the schema, if present', function() {
            var schema = {
                'name': 'aSchema'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema});

            expect(newSchemas.aSchema.name).toBe('aSchema');
        });

        it('is set to the schemaKey, if no name is present in the schema', function() {
            var schema = {
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKey' : schema});

            expect(newSchemas.aKey.name).toBe('aKey');
        });

        it('is set to a modified version of the schemaKey (/\'s and .json removed, -\'s replaced with _\'s)',
            function() {
            var schema = {
            };

            var newSchemas = dx.core.data._prepareSchemas({'/a-Key-name.json' : schema});

            expect(newSchemas.a_Key_name.name).toBe('a_Key_name');
        });
    });

    describe('schema.parentSchema', function() {
        it('connects the super schema info to the data for this schema', function() {
            var schemaA = {
                name: 'aSchema'
            };
            var schemaB = {
                name: 'bSchema',
                'extends' : {
                    $ref: 'aKeyName'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'b': schemaB, 'aKeyName' : schemaA});

            expect(newSchemas.bSchema.parentSchema).toBe(newSchemas.aSchema);
        });

        it('connects the super schema info to the data for this schema, even when the parent has no name', function() {
            var schemaA = {
            };
            var schemaB = {
                name: 'bSchema',
                'extends' : {
                    $ref: 'aKeyName'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schemaA, 'b': schemaB});

            expect(newSchemas.bSchema.parentSchema).toBe(newSchemas.aKeyName);
        });
    });

    describe('schema.extends', function() {
        it('connects the super schema info to the data for this schema', function() {
            var schemaA = {
                name: 'aSchema'
            };
            var schemaB = {
                name: 'bSchema',
                'extends' : {
                    $ref: 'aKeyName'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'b': schemaB, 'aKeyName' : schemaA});

            expect(newSchemas.bSchema.extends.$ref).toBe('aSchema');
        });

        it('connects the super schema info to the data for this schema, even when the parent has no name', function() {
            var schemaA = {
            };
            var schemaB = {
                name: 'bSchema',
                'extends' : {
                    $ref: 'aKeyName'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schemaA, 'b': schemaB});

            expect(newSchemas.bSchema.extends.$ref).toBe('aKeyName');
        });
    });

    describe('schema.root', function() {
        it('gives the schema a root of its grandparent if that grandparent is the closest with root', function() {
            var schema = {
                root: 'some/random/string'
            };
            var child = {
                'extends': {
                    $ref: 'a'
                }
            };
            var grandChild = {
                'extends': {
                    $ref: 'b'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'a' : schema, 'b': child, 'c': grandChild});

            expect(newSchemas.c.root).toBe('some/random/string');
        });

        it('gives the schema a root of its parent even if grandparent also has a root', function() {
            var schema = {
                root: 'some/random/string'
            };
            var child = {
                root: 'some/other/string',
                'extends': {
                    $ref: 'a'
                }
            };
            var grandChild = {
                'extends': {
                    $ref: 'b'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'a' : schema, 'b': child, 'c': grandChild});

            expect(newSchemas.c.root).toBe('some/other/string');
        });
    });

    describe('schema.rootTypeName', function() {
        var noRoot = {
        };
        var parent = {
            root: 'some/random/string'
        };
        var child = {
            'extends': {
                $ref: 'a'
            }
        };
        var altChild = {
            root: 'some/other/path',
            'extends': {
                $ref: 'a'
            }
        };
        var grandChild = {
            'extends': {
                $ref: 'b'
            }
        };
        var altGrandChild = {
            'extends': {
                $ref: 'b2'
            }
        };

        it('is set to undefined when given a type with no root property, nor any ancestor property', function() {
            var newSchemas = dx.core.data._prepareSchemas({a : noRoot});

            expect(newSchemas.a.rootTypeName).toBeUndefined();
        });

        it('is set to this type given a type with a root property ', function() {
            var newSchemas = dx.core.data._prepareSchemas({a : parent});

            expect(newSchemas.a.rootTypeName).toBe('a');
        });

        it('is set to the parent when given a type with a parent with a root property', function() {
            var newSchemas = dx.core.data._prepareSchemas({a : parent, b: child});

            expect(newSchemas.b.rootTypeName).toBe('a');
        });

        it('is set to grandparent when given a type with a grandparent with a root property', function() {
            var newSchemas = dx.core.data._prepareSchemas({a : parent, b: child, c: grandChild});

            expect(newSchemas.c.rootTypeName).toBe('a');
        });

        it('is set to the parent name given a type with a parent that has a root, and itself has a root', function() {
            var newSchemas = dx.core.data._prepareSchemas({a : parent, b2: altChild});

            expect(newSchemas.b2.rootTypeName).toBe('b2');
        });

        it('is set to the parent, given a type with a grantparent that has a root, & parent has a root', function() {
            var newSchemas = dx.core.data._prepareSchemas({a : parent, b2: altChild, c2: altGrandChild});

            expect(newSchemas.c2.rootTypeName).toBe('b2');
        });
    });

    describe('schema.properties', function() {
        var newSchemas;

        function buildSchemas(schema) {
            var schemaA = {
                name: 'A',
                properties: {
                    'aProp' : {
                        type: 'string',
                        'default': 'one'
                    }
                }
            };

            newSchemas = dx.core.data._prepareSchemas({'a' : schemaA, 'b': schema});
        }

        it('overrides the properties from parent types with child types', function() {
            buildSchemas({
                name: 'OverrideB',
                'extends': {
                    '$ref': 'a'
                },
                properties: {
                    'aProp' : {
                        type: 'number',
                        'default': 34.5
                    }
                }
            });
            var schema = newSchemas.OverrideB;

            expect(schema.properties.aProp).toEqual({
                type: 'number',
                'default': 34.5
            });
        });

        it('preserves distinct parent and child types', function() {
            buildSchemas({
                name: 'NonOverrideB',
                'extends': {
                    '$ref': 'a'
                },
                properties: {
                    'bProp' : {
                        type: 'number',
                        'default': 'two'
                    }
                }
            });
            var schema = newSchemas.NonOverrideB;

            expect(schema.properties.aProp).toEqual({
                type: 'string',
                'default': 'one'
            });
            expect(schema.properties.bProp).toEqual({
                type: 'number',
                'default': 'two'
            });
        });

        it('preserves distinct parent and child types', function() {
            var emptyP = {
                name: 'EmptyP'
            };
            var emptyC = {
                name: 'EmptyC',
                'extends': {
                    '$ref': 'e1'
                }
            };
            var newSchemas = dx.core.data._prepareSchemas({'e1' : emptyP, 'e2': emptyC});

            var schema = newSchemas.EmptyC;

            expect(schema.properties).toBeUndefined();
        });

        it('throws an error if an a reference is made to an unknown type', function() {
            var schema = {
                name: 'A',
                properties: {
                    'aProp' : {
                        type: 'array',
                        items: {
                            type: 'object',
                            $ref: 'NOTHERE'
                        }
                    }
                }
            };

            expect(function() {
                dx.core.data._prepareSchemas({'a' : schema});
            }).toDxFail(new Error('Could not find a schema entry for NOTHERE'));
        });

        it('modifies $ref in an array to have the actual schema type name', function() {
            var schema = {
                name: 'A',
                properties: {
                    'aProp' : {
                        type: 'array',
                        items: {
                            type: 'object',
                            $ref: 'aKeyName'
                        }
                    }
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});

            expect(newSchemas.A.properties.aProp.items.$ref).toEqual('A');
        });

        it('modifies referenceTo in an array to have the actual schema type name', function() {
            var schema = {
                name: 'A',
                properties: {
                    'aProp': {
                        type: 'array',
                        items: {
                            type: 'object',
                            referenceTo: 'aKeyName'
                        }
                    }
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({ 'aKeyName': schema });

            expect(newSchemas.A.properties.aProp.items.referenceTo).toEqual('A');
        });

        it('modifies referenceTo in an string/objectReference to name the specified schema entry', function() {
            var schema = {
                name: 'A',
                properties: {
                    'aProp' : {
                        type: 'string',
                        format: 'objectReference',
                        referenceTo: 'aKeyName'
                    }
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});

            expect(newSchemas.A.properties.aProp.referenceTo).toEqual('A');
        });

        it('modifies object/$ref to name the specified schema entry', function() {
            var schema = {
                name: 'A',
                properties: {
                    'aProp' : {
                        type: 'object',
                        $ref: 'aKeyName'
                    }
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});

            expect(newSchemas.A.properties.aProp.$ref).toEqual('A');
        });

        it('modifies a property with an array of types so references name the right schema type', function() {
            var schema = {
                name: 'A',
                properties: {
                    'aProp' : {
                        type: ['object', 'string', 'boolean', 'array', 'number'],
                        $ref: 'aKeyName',
                        format: 'objectReference',
                        referenceTo: 'aKeyName',
                        items: {
                            type: 'object',
                            $ref: 'aKeyName'
                        }
                    }
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});

            expect(newSchemas.A.properties.aProp.$ref).toEqual('A');
            expect(newSchemas.A.properties.aProp.referenceTo).toEqual('A');
            expect(newSchemas.A.properties.aProp.items.$ref).toEqual('A');
        });

        it('adds parent properties to child type, even when child has nothing to start with', function() {
            var schema = {
                properties: {
                    'aProp' : {
                        type: 'string'
                    }
                }
            };
            var childSchema = {
                'extends': {
                    $ref: 'p'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'p' : schema, 'c': childSchema});

            expect(newSchemas.c.properties.aProp.type).toEqual('string');
        });
    });

    describe('operations', function() {
        function makeOperations() {
            var schema1 = {
                root: 'someURL',
                name: 'Payload',
                operations: {
                    sendPayload: {
                        payload: {
                            type: 'object',
                            '$ref': 't'
                        }
                    },
                    emptyPayload: {
                        payload: {
                        }
                    },
                    validateAsPayload: {
                        payload: {
                            type: 'object',
                            '$ref': 't'
                        },
                        validateAs: 'create'
                    },
                    parentOperation: {
                        payload: {
                        },
                        childOperation: {
                            payload: {
                            }
                        },
                        nonOperation: {
                        }
                    }
                }
            };
            var schema2 = {
                root: 'someURL',
                name: 'Parameters',
                operations: {
                    sendParameters: {
                        parameters: {}
                    },
                    noParamsOp: {
                    },
                    refOp: {
                        parameters: {
                            aReference: {
                                type: 'string',
                                format: 'objectReference',
                                referenceTo: 't'
                            }
                        }
                    }
                }
            };
            var schema3 = {
                name: 'AType'
            };

            return dx.core.data._prepareSchemas({'payload' : schema1, 'params': schema2, 't': schema3});
        }

        it('throws an error if operations found on a non-root object', function() {
            var schema = {
                name: 'A',
                operations: {
                }
            };

            expect(function() {
                dx.core.data._prepareSchemas({'aKeyName' : schema});
            }).toDxFail(new Error('Found operations on a non-root schema.'));
        });

        it('throws an error if both payload and parameters defined', function() {
            var schema = {
                root: 'someURL',
                name: 'A',
                operations: {
                    opOne: {
                        payload: {},
                        parameters: {}
                    }
                }
            };

            expect(function() {
                dx.core.data._prepareSchemas({'aKeyName' : schema});
            }).toDxFail(new Error('Found both a payload and a parameters for the operation opOne.'));
        });

        it('is created as a payload operation when there\'s a payload defined in the schema', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Payload.operations.sendPayload).toBeDefined();
        });

        it('will not create an operations object if there are no operations', function() {
            var schema = {
                root: 'someURL',
                name: 'A'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});
            expect(newSchemas.A.operations).toBeUndefined();
        });

        it('is created with a reference to the $ref\'ed schema', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Payload.operations.sendPayload.payload.$ref).toBe('AType');
        });

        it('is created with an empty payload definition when there is no payload defined', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Payload.operations.emptyPayload.payload).toEqual({});
        });

        it('is created with a source-operation when source schema has one', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Payload.operations.parentOperation.dxOperations.childOperation).
                toBeDefined();
        });

        it('is created without picking up other objects as child operations in the definition', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Payload.operations.parentOperation.dxOperations.nonOperation).
                toBeUndefined();
        });

        it('is created as a parameters operation when there is one in the schema', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Parameters.operations.sendParameters).toBeDefined();
        });

        it('is created as a parameters operation even when it is not explicitly stated in the schema', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Parameters.operations.noParamsOp.parameters).toEqual({});
        });

        it('has a parameters operation added with the correct referenceType value set', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Parameters.operations.refOp.parameters.aReference.referenceTo).toEqual('AType');
        });

        it('throws error if both parent and child have operations', function() {
            var schema = {
                root: '/someURL',
                operations: {
                    opOne: {
                    }
                }
            };
            var schema2 = {
                root: '/someOtherURL',
                'extends': {
                    $ref: 'p'
                },
                operations: {
                    opTwo: {
                    }
                }
            };

            expect(function() {
                dx.core.data._prepareSchemas({'p' : schema, 'c': schema2});
            }).toDxFail(new Error('Both p and c have operations. This isn\'t supported.'));
        });

        it('has a payload operation added with the correct $ref value set', function() {
            var schema = {
                root: '/someURL',
                operations: {
                    opOne: {
                        payload: {
                            'type': 'object',
                            '$ref': 'aKeyName'
                        }
                    }
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});

            expect(newSchemas.aKeyName.operations.opOne.payload.$ref).toEqual('aKeyName');
        });

        it('has a parameters operation added with the correct referenceTo value set', function() {
            var schema = {
                root: '/someURL',
                operations: {
                    opOne: {
                        parameters: {
                            p1: {
                                'type': 'string',
                                'format': 'objectReference',
                                'referenceTo': 'aKeyName'
                            }
                        }
                    }
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});

            expect(newSchemas.aKeyName.operations.opOne.parameters.p1.referenceTo).toEqual('aKeyName');
        });

        it('replaces return value with the schema name', function() {
            var schema1 = {
                root: 'someURL',
                name: 'Payload',
                operations: {
                    withReturn: {
                        payload: {
                            type: 'object',
                            '$ref': 't'
                        },
                        'return': {
                            type: 'object',
                            '$ref': 't'
                        }
                    }
                }
            };
            var newSchemas = dx.core.data._prepareSchemas({'t' : schema1});

            expect(newSchemas.Payload.operations.withReturn.return.$ref).toEqual('Payload');
        });

        it('doesn\'t complain if the return type doesn\'t have a reference', function() {
            var schema1 = {
                root: 'someURL',
                name: 'Payload',
                operations: {
                    withTypelessReturn: {
                        payload: {
                            type: 'object',
                            '$ref': 't'
                        },
                        'return': {
                            type: 'object'
                        }
                    }
                }
            };
            var newSchemas = dx.core.data._prepareSchemas({'t' : schema1});

            expect(newSchemas.Payload.operations.withTypelessReturn.return.$ref).toEqual(undefined);
        });

        it('replaces array return value with the schema name', function() {
            var schema1 = {
                root: 'someURL',
                name: 'Payload',
                operations: {
                    withArrayReturn: {
                        payload: {
                            type: 'object',
                            '$ref': 'payload'
                        },
                        'return': {
                            type: 'array',
                            items: {
                                type: 'object',
                                '$ref': 'payload'
                            }
                        }
                    }
                }
            };
            var newSchemas = dx.core.data._prepareSchemas({'payload' : schema1});

            expect(newSchemas.Payload.operations.withArrayReturn.return.items.$ref).toEqual('Payload');
        });

        it('doesn\'t complain if the array return type doesn\'t have a reference', function() {
            var schema1 = {
                root: 'someURL',
                name: 'Payload',
                operations: {
                    withTypelessArrayReturn: {
                        payload: {
                            type: 'object',
                            '$ref': 'payload'
                        },
                        'return': {
                            type: 'array',
                            items: {
                                type: 'object'
                            }
                        }
                    }
                }
            };
            var newSchemas = dx.core.data._prepareSchemas({'payload' : schema1});

            expect(newSchemas.Payload.operations.withTypelessArrayReturn.return.items.$ref).toEqual(undefined);
        });

        it('adds parent object operations to the children', function() {
            var schema1 = {
                root: '/somewhere',
                operations: {
                    one: {
                    }
                }
            };
            var child = {
                'extends': {
                    $ref: 'p'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'p' : schema1, 'c': child});

            expect(newSchemas.p.operations.one).toBeDefined();
            expect(newSchemas.c.operations.one).toBeDefined();
        });
    });

    /*
     * White-box testing note: Most of the implementation of root operations parsing is the same as for operations. So,
     * this does only basic sanity testing.
     */
    describe('rootOperations', function() {
        function makeOperations() {
            var schema1 = {
                root: 'someURL',
                name: 'Payload',
                rootOperations: {
                    sendPayload: {
                        payload: {
                            type: 'object',
                            '$ref': 'params'
                        }
                    }
                }
            };
            var schema2 = {
                root: 'someURL',
                name: 'Parameters',
                rootOperations: {
                    sendParameters: {
                        parameters: {
                            'param1': {
                                type: 'string'
                            }
                        }
                    }
                }
            };
            return dx.core.data._prepareSchemas({'payload' : schema1, 'params': schema2});
        }

        it('throws an error if rootOperations found on a non-root object', function() {
            var schema = {
                name: 'A',
                rootOperations: {
                    opOne: {
                        payload: {}
                    }
                }
            };

            expect(function() {
                dx.core.data._prepareSchemas({'aKeyName' : schema});
            }).toDxFail();
        });

        it('is created for for the corresponding root operation in the schema', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Parameters.rootOperations.sendParameters).toBeDefined();
        });

        it('is created as a parameters operation for a parameters operation in the schema', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Parameters.rootOperations.sendParameters.parameters.param1.type).toEqual('string');
        });

        it('is created as a payload operation for a payload operation in the schema', function() {
            var newSchemas = makeOperations();

            expect(newSchemas.Payload.rootOperations.sendPayload.payload.$ref).toEqual('Parameters');
        });
    });

    describe('create', function() {
        it('throws an error if create found on a non-root object', function() {
            var schema = {
                name: 'A',
                create: {}
            };

            expect(function() {
                dx.core.data._prepareSchemas({'aKeyName' : schema});
            }).toDxFail();
        });

        it('is not added if the schema doesn\'t already have a create operation', function() {
            var schema = {
                root: '/myRoot',
                name: 'A'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});
            expect(newSchemas.A.create).toBeUndefined();
        });

        it('is not added to child schemas if the parent has one', function() {
            var schema = {
                root: '/myRoot',
                name: 'A',
                create: {}
            };
            var schema2 = {
                name: 'B',
                'extends': {
                    $ref: 'a'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'a' : schema, 'b': schema2});
            expect(newSchemas.B.create).not.toBeDefined();
        });
    });

    describe('update', function() {
        it('throws an error if update found on a non-root object', function() {
            var schema = {
                name: 'A',
                update: {
                }
            };

            expect(function() {
                dx.core.data._prepareSchemas({'aKeyName' : schema});
            }).toDxFail();
        });

        it('is not added if the schema doesn\'t already have a create operation', function() {
            var schema = {
                root: '/myRoot',
                name: 'A'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});
            expect(newSchemas.A.update).toBeUndefined();
        });

        it('is added to child schemas if the parent has one', function() {
            var schema = {
                root: '/myRoot',
                name: 'A',
                update: {}
            };
            var schema2 = {
                name: 'B',
                'extends': {
                    $ref: 'a'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'a' : schema, 'b': schema2});
            expect(newSchemas.B.update).toBeDefined();
        });

        it('has the update type of the parent creation operation', function() {
            var schema = {
                root: '/myRoot',
                name: 'A',
                update: {
                    payload: {
                        type: 'object',
                        $ref: 'a'
                    }
                }
            };
            var schema2 = {
                name: 'B',
                'extends': {
                    $ref: 'a'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'a' : schema, 'b': schema2});
            expect(newSchemas.B.update.payload.$ref).toEqual('A');
        });
    });

    describe('delete', function() {
        it('throws an error if delete found on a non-root object', function() {
            var schema = {
                name: 'A',
                'delete': {
                }
            };

            expect(function() {
                dx.core.data._prepareSchemas({'aKeyName' : schema});
            }).toDxFail();
        });

        it('is not added if the schema doesn\'t already have a delete operation', function() {
            var schema = {
                root: '/myRoot',
                name: 'A'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});
            expect(newSchemas.A.delete).toBeUndefined();
        });

        it('is added to child schemas if the parent has one', function() {
            var schema = {
                root: '/myRoot',
                name: 'A',
                'delete': {}
            };
            var schema2 = {
                name: 'B',
                'extends': {
                    $ref: 'a'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'a' : schema, 'b': schema2});
            expect(newSchemas.B.delete).toBeDefined();
        });
    });

    describe('read', function() {
        it('throws an error if read found on a non-root object', function() {
            var schema = {
                name: 'A',
                read: {
                }
            };

            expect(function() {
                dx.core.data._prepareSchemas({'aKeyName' : schema});
            }).toDxFail();
        });

        it('is not added if the schema doesn\'t already have a read operation', function() {
            var schema = {
                root: '/myRoot',
                name: 'A'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});
            expect(newSchemas.A.read).toBeUndefined();
        });

        it('is added to child schemas if the parent has one', function() {
            var schema = {
                root: '/myRoot',
                name: 'A',
                read: {}
            };
            var schema2 = {
                name: 'B',
                'extends': {
                    $ref: 'a'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'a' : schema, 'b': schema2});
            expect(newSchemas.B.read).toBeDefined();
        });
    });

    describe('list', function() {
        it('throws an error if list found on a non-root object', function() {
            var schema = {
                name: 'A',
                list: {
                }
            };

            expect(function() {
                dx.core.data._prepareSchemas({'aKeyName' : schema});
            }).toDxFail();
        });

        it('is not added if the schema doesn\'t already have a list operation', function() {
            var schema = {
                root: '/myRoot',
                name: 'A'
            };

            var newSchemas = dx.core.data._prepareSchemas({'aKeyName' : schema});
            expect(newSchemas.A.list).toBeUndefined();
        });

        it('is not added to child schemas if the parent has one', function() {
            var schema = {
                root: '/myRoot',
                name: 'A',
                list: {}
            };
            var schema2 = {
                name: 'B',
                'extends': {
                    $ref: 'a'
                }
            };

            var newSchemas = dx.core.data._prepareSchemas({'a' : schema, 'b': schema2});
            expect(newSchemas.B.list).not.toBeDefined();
        });
    });

    describe('queryParamAnnotations', function() {
        var schema = {
            root: '/myRoot',
            name: 'A',
            properties: {
                chain: { format: 'objectReference', referenceTo: 'b', type: 'string' },
                bParam: { type: 'integer' }
            },
            list: {
                parameters: {
                    aParam: { type: 'string' },
                    bParam: { type: 'integer' }
                }
            }
        };
        var nextSchema = {
            root: '/nextRoot',
            name: 'Next',
            properties: {
                of: { format: 'objectReference', referenceTo: 'c', type: 'string' }
            }
        };
        var finalSchema = {
            root: '/finalRoot',
            name: 'Final',
            properties: {
                things: { type: 'string' }
            }
        };
        var newSchemas;

        beforeEach(function() {
            var annotations = {
                A: {
                    aParam: {
                        mapsTo: '$chain.$of.things',
                        inequalityType: dx.core.constants.INEQUALITY_TYPES.STRICT,
                        fake: true
                    }
                }
            };

            newSchemas = dx.core.data._prepareSchemas({ 'a' : schema, 'b': nextSchema, 'c': finalSchema }, annotations);
        });

        it('copies the annotations onto the query parameters in the schema', function() {
            dx.test.assert(newSchemas.A.list.parameters.aParam.type).toBe('string');

            expect(newSchemas.A.list.parameters.aParam.mapsTo).toBe('$chain.$of.things');
            expect(newSchemas.A.list.parameters.aParam.fake).toBe(true);
            expect(newSchemas.A.list.parameters.aParam.inequalityType).toBe(dx.core.constants.INEQUALITY_TYPES.STRICT);
        });

        it('adds "mapsTo" if not provided which defaults to the name of the query parameter', function() {
            dx.test.assert(newSchemas.A.list.parameters.bParam.type).toBe('integer');

            expect(newSchemas.A.list.parameters.bParam.mapsTo).toBe('bParam');
        });

        it('does not add default "mapsTo" if the there is no matching property in the schema', function() {
            var altSchema = {
                root: '/myRoot',
                name: 'A',
                properties: {},
                list: {
                    parameters: {
                        aParam: { type: 'string' },
                        bParam: { type: 'integer' }
                    }
                }
            };
            var annotations = {};
            newSchemas = dx.core.data._prepareSchemas({ 'a' : altSchema }, annotations);

            expect(newSchemas.A.list.parameters.aParam.mapsTo).toBeUndefined();
        });

        describe('validation', function() {
            it('fails if a reference in a "mapsTo" chain is not prefixed with a "$"', function() {
                var annotations = {
                    A: {
                        aParam: {
                            mapsTo: 'chain.of.things',
                            inequalityType: dx.core.constants.INEQUALITY_TYPES.STRICT,
                            fake: true
                        }
                    }
                };

                expect(function() {
                    newSchemas = dx.core.data._prepareSchemas({ 'a' : schema, 'b': nextSchema, 'c': finalSchema },
                        annotations);
                }).toDxFail('Can only chain object references (evaluating "chain" in "chain.of.things").');
            });

            it('fails if a property in the "mapsTo" chain cannot be resolved', function() {
                var annotations = {
                    A: {
                        aParam: {
                            mapsTo: '$chain.$of.notthings',
                            inequalityType: dx.core.constants.INEQUALITY_TYPES.STRICT
                        }
                    }
                };

                expect(function() {
                    newSchemas = dx.core.data._prepareSchemas({ 'a' : schema, 'b': nextSchema, 'c': finalSchema },
                        annotations);
                }).toDxFail('Property "notthings" not found for type Final');
            });
        });
    });

});

describe('dx.core.data._prepareEnums', function() {

    it('throws an error if no schema is provided', function() {
        expect(function() {
            dx.core.data._prepareEnums();
        }).toDxFail(new Error('Must provide a set of prepared schemas.'));
    });

    it('handles string type enum properties', function() {
        var schema = {
            TypeName: {
                properties: {
                    propertyName: {
                        type: 'string',
                        'enum': ['value1', 'value2', 'value3']
                    }
                }
            }
        };
        var enums = dx.core.data._prepareEnums(schema);

        expect(enums).toEqual({
            TypeName: {
                propertyName: {
                    value1: 'value1',
                    value2: 'value2',
                    value3: 'value3'
                }
            }
        });
    });

    it('handles integer type enum properties', function() {
        var schema = {
            TypeName: {
                properties: {
                    propertyName: {
                        type: 'integer',
                        'enum': [1, 2, 3]
                    }
                }
            }
        };
        var enums = dx.core.data._prepareEnums(schema);

        expect(enums).toEqual({
            TypeName: {
                propertyName: {
                    '1': 1,
                    '2': 2,
                    '3': 3
                }
            }
        });
    });

    it('handles number type enum properties', function() {
        var schema = {
            TypeName: {
                properties: {
                    propertyName: {
                        type: 'number',
                        'enum': [0.1, 2.34, 3.96]
                    }
                }
            }
        };
        var enums = dx.core.data._prepareEnums(schema);

        expect(enums).toEqual({
            TypeName: {
                propertyName: {
                    '0.1': 0.1,
                    '2.34': 2.34,
                    '3.96': 3.96
                }
            }
        });
    });

    it('handles properties that are arrays of enums', function() {
        var schema = {
            TypeName: {
                properties: {
                    propertyName: {
                        type: 'array',
                        items: {
                            type: 'string',
                            'enum': ['value1', 'value2', 'value3']
                        }
                    }
                }
            }
        };

        var enums = dx.core.data._prepareEnums(schema);

        expect(enums).toEqual({
            TypeName: {
                propertyName: {
                    value1: 'value1',
                    value2: 'value2',
                    value3: 'value3'
                }
            }
        });
    });

    it('handles enums that are parameters for list operations', function() {
        var schema = {
            TypeName: {
                list: {
                    parameters: {
                        parameterName: {
                            type: 'string',
                            'enum': ['value1', 'value2', 'value3']
                        }
                    }
                }
            }
        };

        var enums = dx.core.data._prepareEnums(schema);

        expect(enums).toEqual({
            TypeName: {
                parameterName: {
                    value1: 'value1',
                    value2: 'value2',
                    value3: 'value3'
                }
            }
        });
    });

    it('handles enums that are parameters for object operations', function() {
        var schema = {
            TypeName: {
                operations: {
                    operationName: {
                        parameters: {
                            parameterName: {
                                type: 'string',
                                'enum': ['value1', 'value2', 'value3']
                            }
                        }
                    }
                }
            }
        };

        var enums = dx.core.data._prepareEnums(schema);

        expect(enums).toEqual({
            TypeName: {
                parameterName: {
                    value1: 'value1',
                    value2: 'value2',
                    value3: 'value3'
                }
            }
        });
    });

    it('handles enums that are parameters for root operations', function() {
        var schema = {
            TypeName: {
                rootOperations: {
                    operationName: {
                        parameters: {
                            parameterName: {
                                type: 'string',
                                'enum': ['value1', 'value2', 'value3']
                            }
                        }
                    }
                }
            }
        };

        var enums = dx.core.data._prepareEnums(schema);

        expect(enums).toEqual({
            TypeName: {
                parameterName: {
                    value1: 'value1',
                    value2: 'value2',
                    value3: 'value3'
                }
            }
        });
    });

});

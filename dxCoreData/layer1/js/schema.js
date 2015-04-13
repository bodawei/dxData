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
 * Copyright (c) 2013, 2014 by Delphix. All rights reserved.
 */

/*global dx, _ */

'use strict';

dx.namespace('dx.core.data');

(function() {

/*
 * Do top-level processing of each schema. This involves:
 *  1) Extend the schemas with any query param annotations that are provided.
 *  2) If the schema has no name, replace it with a name, based on the schemaKey, that can be used as a Javascript
 *     identifier.
 *  3) Replace the extends schemaKey (if present) with the name of the parent schema.
 *  4) Add a parentSchema property with a reference to the parent schema, if any.
 *  5) Add the name of the closest ancestor schema type that had a root property.
 *  6) Inherit the parent's root property, if this itself doesn't have one.
 */
function processSchema(schema, schemaKey, sourceSchemas, queryParamAnnotations, newSchemas, preserveUnneeded) {
    /*
     * Most schemas have a name. However, not all do.  We must nevertheless expose those schemas as they have root
     * operations on them. Thus, we convert the key into a form that can be used to identify them.
     */
    schema.name = schemaKeyToTypeName(schemaKey, sourceSchemas);

    // If this schema has already been processed (see recursive call, below), return it
    if (newSchemas[schema.name]) {
        return newSchemas[schema.name];
    }

    newSchemas[schema.name] = schema;

    if (schema.root) {
        schema.rootTypeName = schema.name;
    }

    // Process the parent schema, if any. This assumes all extends schemas have just a $ref property.
    var parentSchema = schema.extends;
    if (parentSchema) {
        schema.parentSchema = processSchema(sourceSchemas[parentSchema.$ref], parentSchema.$ref,
            sourceSchemas, queryParamAnnotations, newSchemas);
        parentSchema.$ref = schemaKeyToTypeName(parentSchema.$ref, sourceSchemas);
        parentSchema = schema.parentSchema;

        if (!schema.rootTypeName) {
            schema.rootTypeName = parentSchema.rootTypeName;
        }

        schema.root = schema.root || parentSchema.root;
    }

    if (!preserveUnneeded) {
        delete schema.description;
    }

    processProperties(schema, parentSchema, sourceSchemas, preserveUnneeded);
    processOperations(schema, parentSchema, sourceSchemas);

    addQParamAnnotations(schema, queryParamAnnotations);

    return schema;
}

/*
 * The schemaKeys we get are often of the form /some-name.json. Some of the characters that show up there can not be
 * used as a Javascript identifier, and so we modify the above into a Javascript compatible form. For example the
 * above would become some_name.
 */
function schemaKeyToTypeName(schemaKey, schemas) {
    if (!schemas[schemaKey]) {
        dx.fail('Could not find a schema entry for ' + schemaKey);
    }

    if (schemas[schemaKey].name) {
        return schemas[schemaKey].name;
    }

    var newString = schemaKey.replace(/\.json$/, '').
        replace(/-/g, '_').
        replace(/\//g, '');

    return newString;
}

/*
 * Copy query param annotations onto the schema, and add defaults where applicable.
 */
function addQParamAnnotations(schema, queryParamAnnotations) {
    if (!schema.list) {
        return;
    }

    _.each(schema.list.parameters, function(qParam, qParamName) {
        var annotations = queryParamAnnotations[schema.name] || {};
        var qParamAnnotation = annotations[qParamName] || {};

        // If mapsTo isn't specified, the query param maps to the object property of the same name
        if (!_.isString(qParamAnnotation.mapsTo)) {
            if (schema.properties && schema.properties[qParamName]) {
                qParamAnnotation.mapsTo = qParamName;
            }
        }

        _.extend(qParam, qParamAnnotation);
    });
}

/*
 * Process the properties. As far as this is concerned, properties are one of:
 * A simple primitive value
 *     propertyName: {
 *         type: string|number|integer|boolean|null,
 *         [default: value]
 *     }
 *  or a simple object
 *     propertyName: {
 *         type: object
 *     }
 *  or an 'embedded object'
 *     propertyName: {
 *         type: object,
 *         $ref: schemaKey
 *     }
 *  or a 'referenced object'
 *     propertyName: {
 *         type: string,
 *         format: objectReference,
 *         [referenceTo: schemaKey]
 *     }
 *  or an array
 *     propertyName: {
 *         type: array,
 *         [items: {
 *             type: string|number|integer|boolean|null|object,
 *             [$ref: schemaKey]
 *         }]
 *     }
 *  note: $ref may only present if the type is object.
 * Also the type can be an array of any of the things above.
 *
 * Any one of these may also have these values:
 *         [create: required|optional|readonly,]
 *         [update: required|optional|readonly,]
 *         [required: true|false]
 * Note that there are many other validation related properties, but they are not altered by this processing.
 *
 * This does two things:
 *  1) provides 'property inheritance' by copying the parent's properties (if any) and replacing them as appropriate
 *     with this schema's properties.
 *  2) Replaces any references to schema types with the type name of the target types.
 */
function processProperties(schema, parentSchema, sourceSchemas, preserveUnneeded) {
    if (!schema.properties && !(parentSchema && parentSchema.properties)) {
        return;
    }

    var parentProps = (parentSchema && parentSchema.properties) ? _.clone(parentSchema.properties) : {};
    var propKeys = _.keys(schema.properties || {});
    schema.properties = _.extend(schema.properties || {}, _.omit(parentProps, propKeys));

    // Modify any of the schemas own properties
    _.each(propKeys, function(propName) {
        var propData = schema.properties[propName];

        convertTypeReference(propData, sourceSchemas);

        if (!preserveUnneeded) {
            delete propData.description;
        }
    });
}

/*
 * Process all operations. these look like the following:
 *     operations: {
 *         operationName: { ... details ... },
 *         ...
 *     }
 * or
 *     rootOperations: {
 *         operationName: { ... details ... },
 *         ...
 *     }
 * or one of the following
 *     create: { ... details ... }
 *     read: { ... details ... }
 *     list: { ... details ... }
 *     update: { ... details ... }
 *     delete: { ... details ... }
 *
 * This makes the following changes to these schemas:
 *  1) Schemas that are extensions of a root schema will inherit their parents' operations
 *  2) Standard operations update, delete and read are propogated down to child objects. List and create are not
 */
function processOperations(schema, parentSchema, sourceSchemas) {
    // Do some schema validation
    var schemaOps = _.pick(schema, ['operations', 'rootOperations', 'create', 'read', 'list', 'update', 'delete']);
    if (!schema.root && !_.isEmpty(schemaOps)) {
        dx.fail('Found ' + _.keys(schemaOps) + ' on a non-root schema.');
    }

    if (schema.operations && parentSchema && parentSchema.operations) {
        dx.fail('Both ' + parentSchema.name + ' and ' + schema.name + ' have operations. This isn\'t supported.');
    }

    var parentOps = (parentSchema && parentSchema.operations) ? parentSchema.operations : {};
    var opKeys = schema.operations ? _.keys(schema.operations) : [];
    var myOperations = _.extend(schema.operations || {}, _.omit(parentOps, opKeys));

    if (!_.isEmpty(myOperations)) {
        schema.operations = myOperations;

        _.each(opKeys, function(opName) {
            processOperation(schema.operations[opName], opName, sourceSchemas);
        });
    }

    _.each(schema.rootOperations, function(opInfo, opName) {
        processOperation(opInfo, opName, sourceSchemas);
    });

    var pSchema = parentSchema || {};
    _.each(['create', 'update', 'read', 'list', 'delete'], function(opName) {
        var opDef = schema[opName];
        if (!dx.core.util.isNone(opDef)) {
            if (opName === 'create' || opName === 'update') {
               opDef.validateAs = opDef.validateAs || opName;
            }

            processOperation(opDef, opName, sourceSchemas);
        }

        if (opName !== 'create' && opName !== 'list') {
            schema[opName] = opDef || pSchema[opName];
        }
    });
}

/*
 * Process each operation. This generalizes across standard, object and root operations. These are expected to be of
 * the form:
 *     operationName: {
 *         payload: {
 *             [type: 'object',
 *             $ref: url-to-type]
 *         }
 *         [validateAs: create|update]
 *         [required: true|false]
 *         [return: ...]
 *     }
 * or
 *     operationName: {
 *         parameters: {
 *             ...
 *         }
 *         [return: ...]
 *     }
 * or the following, which means a GET with no parameters
 *     operationName: {
 *     }
 * Any one of those may have a 'sub-operation' of the same form (though, the last, with neither payload nor
 * parameters defined will be recognized, simply because it is ambiguous with other entries).
 *         subOpName: {
 *             payload: {...},
 *             [validateAs: create|update]
 *             [return: ...]
 *          }
 * or
 *         subOpName: {
 *             parameters: {...},
 *             [return: ...]
 *          }
 * The parameters are expected to be one of the following forms:
 *     paramName: {
 *         type: typeName,
 *         [format: formatValue],
 *         [enum: [values...]],
 *         [default: defaultValue]
 *         [required: true|false]
 *     }
 * or
 *     paramName: {
 *         type: 'string',
 *         format: 'objectReference',
 *         referenceTo: schemaKey
 *         [required: true|false]
 *     }
 * While, the return value is expected to be one of the following:
 *     return : {
 *        type: typeName,
 *         [format: formatValue]
 *     }
 * or
 *     return : {
 *        type: typeName,
 *         [$ref: schemaKey]
 *     }
 * or
 *     return : {
 *        type: 'array',
 *         [items: {
 *             $ref: schemaKey
 *         }]
 *     }
 * or
 *     return : {
 *        type: 'array',
 *         [items: {
 *             referenceTo: schemaKey
 *         }]
 *     }
 * These will be modified in these ways:
 *  1) $ref and referenceTo's will be set to type name of the relevant schemas
 *  2) Any sub-operation is extracted from its default location, and put into a sub-object called dxOperations
 *  3) in the case of a 'missing' parameters, an empty one will be inserted.
 *  4) Any $ref in the return value or the return.items value will be replaced with the type name of the schema.
 * Thus, we get:
 * {
 *     payload: {
 *         ...payload properties...
 *         $ref: <related schema>
 *     }
 *     validateAs: create|update,
 *     [dxOperations: {
 *         // sub-operations
 *     }]
 * }
 * or
 * {
 *     parameters: {
 *         ... parameters info, with any referenceTo's set to the actual related schema ...
 *     },
 *     [dxOperations: {
 *         // sub-operations
 *     }]
 * }
 */
function processOperation(opDef, opName, sourceSchemas) {
    if (opDef.payload) {
        if (opDef.parameters) {
            dx.fail('Found both a payload and a parameters for the operation ' + opName + '.');
        }
        if (opDef.payload.$ref) {
            opDef.payload.$ref = schemaKeyToTypeName(opDef.payload.$ref, sourceSchemas);
        }
    } else {
        opDef.parameters = opDef.parameters || {};

        _.each(opDef.parameters, function(value) {
            if (value.referenceTo) {
                value.referenceTo = schemaKeyToTypeName(value.referenceTo, sourceSchemas);
            }
        });
    }

    if (opDef.return) {
        convertTypeReference(opDef.return, sourceSchemas);
    }

    // Move any sub-operations into a sub-object
    _.each(opDef, function(value, key) {
        if (key === 'payload' || key === 'parameters') {
            return;
        }
        if (value.payload || value.parameters) {
            opDef.dxOperations = opDef.dxOperations || {};
            opDef.dxOperations[key] = processOperation(value, opName + '.' + key, sourceSchemas);
            delete opDef[key];
        }
    });

    return opDef;
}

/*
 * Given a type reference (a property type definition, or a return value definition), convert any references to
 * schema types from schemaKey format to the actual type name.
 */
function convertTypeReference(propData, sourceSchemas) {
    function convertReferences(type, propData) {
        if (type === 'array' && _.has(propData, 'items')) {
            if (_.has(propData.items, '$ref')) {
                propData.items.$ref = schemaKeyToTypeName(propData.items.$ref, sourceSchemas);
            } else if (_.has(propData.items, 'referenceTo')) {
                propData.items.referenceTo = schemaKeyToTypeName(propData.items.referenceTo, sourceSchemas);
            }
        }

        if (type === 'string' && propData.format === 'objectReference' && propData.referenceTo) {
            propData.referenceTo = schemaKeyToTypeName(propData.referenceTo, sourceSchemas);
        }

        if (type === 'object' && propData.$ref) {
            propData.$ref = schemaKeyToTypeName(propData.$ref, sourceSchemas);
        }
    }

    if (_.isArray(propData.type)) {
        _.each(propData.type, function(typeItem) {
            convertReferences(typeItem, propData);
        });
    } else {
        convertReferences(propData.type, propData);
    }
}

/*
 * Basic validation of the queryParamAnnotations. This includes checking that the 'mapsTo' are chains of valid schema
 * properties.
 * Note that this expects the passed in 'schemas' to already be processed.
 */
function checkQPAnnotations(schemas, queryParamAnnotations) {
    _.each(queryParamAnnotations, function(value, key) {
        _.each(value, function(qParam) {
            if (!_.isString(qParam.mapsTo)) {
                return;
            }

            var segs = qParam.mapsTo.split('.');
            var numSegs = segs.length;

            var currType = key;
            var currSchema = schemas[currType];
            _.each(segs, function(seg, idx) {
                if (idx !== numSegs - 1) {
                    if (seg.charAt(0) !== '$') {
                        dx.fail('Can only chain object references (evaluating "' + seg + '" in "' + qParam.mapsTo +
                            '").');
                    }
                    seg = seg.slice(1);
                }

                var prop = currSchema.properties[seg];
                if (!prop) {
                    dx.fail('Property "' + seg + '" not found for type ' + currType);
                }

                currType = prop.referenceTo;
                currSchema = schemas[currType];
            });
        });
    });
}

/*
 * Walk through each list operation, and add a dxFilterMode property to each. The values are:
 *    none: There are no query parameters, no no filter is needed
 *    uber: Every parameter has a mapsTo property, so the uberFilter can be used
 *    custom: Not enough information. A custom filter will be needed.
 */
function markListOperations(schemas) {
    _.each(schemas, function(schema) {
        if (schema.list) {
            if (_.isEmpty(schema.list.parameters)) {
                schema.list.dxFilterMode = 'none';
            } else {
                var missingMapsTo = false;
                _.each(schema.list.parameters, function(param) {
                    if (!param.mapsTo) {
                        missingMapsTo = true;
                    }
                });
                schema.list.dxFilterMode = missingMapsTo ? 'custom' : 'uber';
            }
        }
    });
}

/*
 * Given a set of schemas, modify them so that they are more easily consumable by other layers of the data system.
 *
 * Specifically, this expects the schemas to come in the form:
 * {
 *     'schemaKey': {
 *        [name: typeName,]
 *        [singleton: true|false,]
 *        [extends: { $ref: 'schemaKey' },]
 *        [root: 'url-fragment',]
 *        [properties: {...},]
 *        [create: {...},]
 *        [read: {...},]
 *        [list: {...},]
 *        [update: {...},]
 *        [delete: {...},]
 *        [operations: {...},]
 *        [rootOperations: {...}]
 *     },
 *     ...
 * }
 * Each schema may include other properties, but this will ignore them.
 *
 * The return value from this routine is a new version of the schemas, with modifications as discussed in each section
 * below.
 *
 * schemas:               The set of schemas to be prepared.  This is the only parameter that must be provided.
 * queryParamAnnotations: The set of 'annotations' to add to schema query parameters. This expects annotations to come
 *                        in the form:
 *                        {
 *                           Type1: {
 *                               qParam1: {
 *                                   annotation1: val1,
 *                                   annotation2: val2,
 *                                   ...
 *                               },
 *                               ...
 *                           },
 *                           ...
 *                        }
 *
 * copySchemas:           If truthy, this will make a copy of the provided schemas before making changes to them.
 *                        Otherwise the original schema objects will be altered.
 * preserveUnneeded:      If truthy, properties like 'description' that aren't needed will not be deleted.
 */
function prepareSchemas(schemas, queryParamAnnotations, copySchemas, preserveUnneeded) {
    var newSchemas = {};

    if (!_.isObject(schemas)) {
        dx.fail('Must provide a schemas object.');
    }

    if (!_.isUndefined(queryParamAnnotations) && !_.isObject(queryParamAnnotations)) {
        dx.fail('queryParamAnnotations is defined but not an object.');
    }

    // Always copy the schemas at this time, as it caused model-generator to be unhappy.
    if (copySchemas || true) {
        schemas = dx.core.util.deepClone(schemas);
    }

    queryParamAnnotations = queryParamAnnotations || {};

    _.each(schemas, function(value, key) {
        processSchema(value, key, schemas, queryParamAnnotations, newSchemas, preserveUnneeded);
    });

    /*
     * Do some simple checks on the queryParamAnnotations to make sure they are valid. This is done after processing
     * the schemas for the convenience of working with the processed, rather than raw, schemas.
     */
    checkQPAnnotations(newSchemas, queryParamAnnotations);
    
    /*
     * Finally, add a flag to each list operation to determine whether it can be generically filtered, or whether
     * it needs help
     */
    markListOperations(newSchemas);

    return newSchemas;
}

/*
 * Given a set of prepared schemas, this will find enums that are properties of a type and enums that are defined as
 * parameters of list, object, and root operations.  The expected input format of the prepared schemas is as follows:
 *
 *  {
 *      typeName: {
 *          [properties: {
 *              propertyName: {
 *                  enum: [value, ...]
 *              },
 *              arrayPropertyName: {
 *                  items: {
 *                      enum: [value, ...]
 *                  }
 *              }
 *          },]
 *          [list: {
 *              parameters: {
 *                  parameterName: {
 *                      enum: [value, ...]
 *                  }
 *              }
 *          },]
 *          [rootOperations|operations: {
 *              operationName: {
 *                  parameters: {...}
 *              }
 *          }]
 *      }
 *  }
 *
 * No specific types, properties or parameters are required, and excess properties will be ignored.  The output is an
 * object where each type and its enums can be accessed as properties:
 *
 *  {
 *      typeName: {
 *          (property|operation)Name: {
 *              value: value
 *              ...
 *          }
 *      }
 *  }
 *
 */
function prepareEnums(schemas) {
    var enums = {};

    if (!_.isObject(schemas)) {
        dx.fail('Must provide a set of prepared schemas.');
    }

    function processEnum(type, name, definition) {
        var enumType = enums[type] = enums[type] || {};
        var enumProp = enumType[name] = enumType[name] || {};
        _.each(definition.enum, function(enumVal) {
            enumProp[enumVal] = enumVal;
        });
    }

    function processParameters(type, opDef) {
        _.each(opDef.parameters, function(paramDef, paramName) {
            if (paramDef.enum) {
                processEnum(type, paramName, paramDef);
            }
        });
    }

    _.each(schemas, function(schema, type) {
        _.each(schema.properties, function(propDef, propName) {
            if (propDef.enum) {
                processEnum(type, propName, propDef);
            // Array of enums
            } else if (propDef.items && propDef.items.enum) {
                processEnum(type, propName, propDef.items);
            }
        });

        // Collect enums from list, root operation, and object operation parameters
        if (schema.list) {
            processParameters(type, schema.list);
        }
        _.each(schema.rootOperations, function(rootOpDef) {
            processParameters(type, rootOpDef);
        });
        _.each(schema.operations, function(opDef) {
            processParameters(type, opDef);
        });
    });

    return enums;
}

_.extend(dx.core.data, {
    _prepareSchemas: prepareSchemas,
    _prepareEnums: prepareEnums
});

})();

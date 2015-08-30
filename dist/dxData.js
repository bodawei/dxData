(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

/*global _, dx */

'use strict';

/*
 * Misc "common code" needed by the dxData code
 */
(function() {

/*
 * Delphix framework/top-level namespace
 */
window.dx = window.dx || {
    namespace: function(namespace) {
        var current = window;
        _.each(namespace.split('.'), function(pName) {
            current = (current[pName] = current[pName] || {});
        });
        return current;
    },
 
    /*
     * Report a failing message. Writes the info to the console and throws an error
     */
    fail: function() {
        window.console.error.call(window.console, arguments);
        throw new Error(arguments[0]);
    },
 
    /*
     * Report a warning message. Writes the info to the console
     */
    warn: function() {
        window.console.warn.call(window.console, arguments);
    },

    /*
     * Report an info message. Writes the info to the console
     */
    info: function() {
        window.console.info.call(window.console, arguments);
    },

    /*
     * Report an debug message. Writes the info to the console
     */
    debug: function() {
        window.console.info.call(window.console, arguments);
    },

    /*
     * Dummy stub for a localization system
     */
    gls: function(message) {
        return '[' + message + ']';
    }
};

/*
 * Constants
 */
dx.namespace('dx.core.constants');

dx.core.constants = {
    INEQUALITY_TYPES: {
        STRICT: 'STRICT',
        NON_STRICT: 'NON-STRICT'
    },
    LIST_TYPES: {
        NONE:   'NONE',
        UBER:   'UBER',
        CUSTOM: 'CUSTOM'
    }
};

/*
 * General utilities
 */
dx.namespace('dx.core.util');

dx.core.util = {
    /*
     * Short cut for checking if a value is either null or undefined
     */
    isNone: function(value) {
        return _.isNull(value) || _.isUndefined(value);
    },
 
    /*
     * Stub for reloading the client in the case we've been told by the server we are out of sync
     */
    reloadClient: function() {
    },

    /*
     * Returns a new object that is a deep clone of the input object.
     */
    deepClone: function(obj) {
        var result = obj;

        if (_.isArray(obj)) {
            result = [];
            _.each(obj, function(value, index) {
                result[index] = dx.core.util.deepClone(value);
            });
        } else if (_.isObject(obj)) {
            if (obj instanceof Date) {
                result = new Date(obj.getTime());
            } else {
                result = {};
                _.each(obj, function(value, index) {
                    result[index] = dx.core.util.deepClone(value);
                });
            }
        }

        return result;
    }

};

/*
 * Ajax utility routines
 */
dx.namespace('dx.core.ajax');

/*
 * Wrapper function for jquery $.ajax function
 *    config - $.ajax configuration object.
 */
dx.core.ajax = {
    ajaxCall: function(config) {
        if (config && config.url) {
            config.type = config.type || 'GET';
            config.contentType = config.contentType || 'application/json';
            config.dataType = config.dataType || 'json';

            config.xhrFields = config.xhrFields || {
                withCredentials: true
            };

            config.success = config.success || function(d) {
                dx.debug(d);
            };

            config.error = config.error || function(e) {
                dx.debug(e);
            };

            config.cache = config.cache || false;

            try {
                $.ajax(config);
            } catch (e) {
                dx.fail(e.message);
            }
        } else {
            dx.fail('Invalid configuration for jQuery ajax call. Unable to complete the operation.');
        }
    }
};

})();
},{}],2:[function(require,module,exports){
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

/*global dx, _ */

'use strict';

dx.namespace('dx.core.data');

(function() {

/*
 * Do top-level processing of each schema. This involves:
 *  1) If the schema has no name, replace it with a name, based on the schemaKey, that can be used as a Javascript
 *     identifier.
 *  2) Replace the extends schemaKey (if present) with the name of the parent schema.
 *  3) Add a parentSchema property with a reference to the parent schema, if any.
 *  4) Add the name of the closest ancestor schema type that had a root property.
 *  5) Inherit the parent's root property, if this itself doesn't have one.
 */
function processSchema(schema, schemaKey, sourceSchemas, newSchemas, preserveUnneeded) {
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
            sourceSchemas, newSchemas);
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

    var newString = schemaKey.replace(/\.json$/, '')
        .replace(/-/g, '_')
        .replace(/\//g, '');

    return newString;
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
 * Walk through each list operation, and add a dxFilterMode property to each. The values are:
 *    none: There are no query parameters, no filter is needed
 *    uber: Every parameter has a mapsTo property, so the uberFilter can be used
 *    custom: Not enough information. A custom filter will be needed.
 */
function markListOperations(schemas) {
    _.each(schemas, function(schema) {
        if (schema.list) {
            if (_.isEmpty(schema.list.parameters)) {
                schema.list.dxFilterMode = dx.core.constants.LIST_TYPES.NONE;
            } else {
                var missingMapsTo = false;
                _.any(schema.list.parameters, function(param) {
                    if (!param.mapsTo) {
                        missingMapsTo = true;
                        return true;
                    }
                });
                schema.list.dxFilterMode = missingMapsTo ? dx.core.constants.LIST_TYPES.CUSTOM :
                    dx.core.constants.LIST_TYPES.UBER;
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
 * copySchemas:           If truthy, this will make a copy of the provided schemas before making changes to them.
 *                        Otherwise the original schema objects will be altered.
 * preserveUnneeded:      If truthy, properties like 'description' that aren't needed will not be deleted.
 */
function prepareSchemas(schemas, copySchemas, preserveUnneeded) {
    var newSchemas = {};

    if (!_.isObject(schemas)) {
        dx.fail('Must provide a schemas object.');
    }

    // Always copy the schemas at this time, as it caused model-generator to be unhappy.
    if (copySchemas || true) {
        schemas = dx.core.util.deepClone(schemas);
    }

    _.each(schemas, function(value, key) {
        processSchema(value, key, schemas, newSchemas, preserveUnneeded);
    });
    
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

},{}],3:[function(require,module,exports){
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
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global dx, _, Backbone */

'use strict';

dx.namespace('dx.core.data');

(function() {

function dumpEventListners(eventLadenObject) {
    var functionNameRegEx = /.*function *([^ \(]*) *\(/;
    _.each(eventLadenObject._events, function(listenerArray, eventName) {
        var anonymousCount = 0;
        var callbackNames = _.reduce(listenerArray, function(memo, item) {
            if (item.callback) {
                var functionString = item.callback.toString();
                var functionName = functionString.match(functionNameRegEx);
                if (functionName && functionName[1] !== '') {
                    memo.push(functionName[1]);
                } else {
                    anonymousCount++;
                }
            }
            return memo;
        }, []);

        // Don't show the internal callbacks used by this cache to mange the models. These never affect prune().
        if (callbackNames.length === 1 &&
            (eventName === 'badReference' && callbackNames[0] === 'handle404' ||
            eventName === 'change' && callbackNames[0] === 'updateCollections')) {
            return;
        }
        var suffix = callbackNames.length === 0 ? '' : '. ' + callbackNames.join(',');
        if (anonymousCount > 0) {
            suffix += ' (' + anonymousCount + ' anonymous)';
        }
        dx.info('   ' + eventName + ' : ' + listenerArray.length + ' callbacks' + suffix);
    });
}

/*
 * A simple cache of subscribers (collections or notification listeners).  Note that these are stored by the type that
 * the list operation for the specified type returns, which in some cases is different than the specified type.
 * This is a private type, so it does no checking of arguments.
 */
function ModelSubscriberStore() {
    var modelSubscribersByType = {};

    function forEachSubscription(functionToApply) {
        _.each(modelSubscribersByType, function(subscriber) {
            _.each(subscriber, functionToApply);
        });
    }

    function add(subscriber) {
        var baseType = subscriber._dxInfo.baseType;
        modelSubscribersByType[baseType] = modelSubscribersByType[baseType] || [];

        if (modelSubscribersByType[baseType].indexOf(subscriber) === -1) {
            modelSubscribersByType[baseType].push(subscriber);
        }
    }

    function remove(subscriber) {
        var baseType = subscriber._dxInfo.baseType;
        var index = modelSubscribersByType[baseType].indexOf(subscriber);
        if (index !== -1) {
            if (subscriber instanceof Backbone.Collection) {
                subscriber.clear();
            }
            modelSubscribersByType[baseType].splice(index, 1);

            if (_.isEmpty(modelSubscribersByType[baseType])) {
                delete modelSubscribersByType[baseType];
            }
        }
    }

    function hasType(typeName) {
        return !!modelSubscribersByType[typeName];
    }

    function getAllOfType(typeName) {
        return modelSubscribersByType[typeName] || [];
    }

    /*
     * Forcibly empty all collections in the store, and then remove all subscribers
     */
    function reset() {
        var toRemove = [];

        // accumulate the items to remove
        forEachSubscription(function(subscriber) {
            toRemove.push(subscriber);
        });

        // now remove them (removing while accumulating can mess up the loops)
        _.each(toRemove, remove);
    }

    /*
     * Remove all subscribers that have no more listeners
     */
    function prune() {
        var toRemove = [];

        forEachSubscription(function(subscriber) {
            if (subscriber instanceof Backbone.Collection) {
                if (_.isEmpty(subscriber._events)) {
                    toRemove.push(subscriber);
                }
            } else if (!subscriber.inUse) {
                // it is a creation Listener
                toRemove.push(subscriber);
            }
        });

        _.each(toRemove, remove);
    }

    /*
     * Returns:
     *    true: If the store has no subscribers
     *    false: if the store has one or more subscribers
     */
    function isEmpty() {
        return _.isEmpty(modelSubscribersByType);
    }

    /*
     * Write out the subscribers.
     */
    function dump() {
        dx.info('SUBSCRIBERS');
        dx.info('===========');
        dx.info(modelSubscribersByType);
    }

    function dumpText() {
        dx.info('SUBSCRIBERS');
        dx.info('===========');
        if (_.isEmpty(modelSubscribersByType)) {
            dx.info('None.');
        }
        var types = _.keys(modelSubscribersByType);
        _.each(types.sort(), function(typeName) {
            dx.info(typeName);
            dx.info('-------------');
            _.each(modelSubscribersByType[typeName], function(subscriber) {
                if (subscriber instanceof Backbone.Collection) {
                    var collection = subscriber;
                    var references = collection.reduce(function(memo, item) {
                        if (item.id) {
                            memo.push(item.id);
                        }
                        return memo;
                    }, []);

                    var suffix = references.length === 0 ? '' :  '. IDs: ' + references.join(', ');
                    dx.info('   ' + collection.length + ' model collection' + suffix);
                    dumpEventListners(collection);
                } else {
                    var qp = subscriber.getQueryParameters();
                    dx.info('Notification Listener with query params: ' + (qp ? JSON.stringify(qp) : 'None'));
                }
            });
        });
    }

    return {
        _modelSubscribers: modelSubscribersByType,
        add: add,
        remove: remove,
        hasType: hasType,
        getAllOfType: getAllOfType,
        reset: reset,
        dump: dump,
        prune: prune,
        isEmpty: isEmpty,
        dumpText: dumpText
    };
}

/*
 * A simple cache of singletons.  This is a private type, so it does no checking of arguments.
 */
function SingletonStore() {
    var singletons = {};

    function add(singleton) {
        singletons[singleton.get('type')] = singleton;
    }

    function get(typeName) {
        return singletons[typeName];
    }

    function remove(singleton) {
        if (!_.isUndefined(singletons[singleton.get('type')])) {
            delete singletons[singleton.get('type')];
        }
    }

    function hasType(typeName) {
        return !!singletons[typeName];
    }

    /*
     * Forcibly remove all singletons
     */
    function reset() {
        _.each(_.keys(singletons), function(typeName) {
            delete singletons[typeName];
        });
    }

    /*
     * Remove all singletons that have no more listeners
     */
    function prune() {
        var toRemove = _.filter(singletons, function(singleton) {
            return _.isEmpty(singleton._events);
        });

        _.each(toRemove, function(model) {
            delete singletons[model.get('type')];
        });
    }

    /*
     * Returns:
     *    true: If the store has no singletons
     *    false: if the store has one or more singletons
     */
    function isEmpty() {
        return _.isEmpty(singletons);
    }

    /*
     * Write out the singletons.
     */
    function dump() {
        dx.info('SINGLETONS');
        dx.info('==========');
        dx.info(singletons);
    }

    function dumpText() {
        dx.info('SINGLETONS');
        dx.info('==========');
        if (_.isEmpty(singletons)) {
            dx.info('None.');
        }
        _.each(singletons, function(singleton, typeName) {
            dx.info(typeName);
            dumpEventListners(singleton);
        });
    }

    return {
        _singletons: singletons,
        add: add,
        get: get,
        remove: remove,
        hasType: hasType,
        reset: reset,
        dump: dump,
        prune: prune,
        isEmpty: isEmpty,
        dumpText: dumpText
    };
}

/*
 * A simple cache of models.  These are organized by root type, then reference. This is a private type, so it does no
 * signifianct checking of arguments.
 */
function ModelStore(context) {
    var modelsByTypeThenRef = {};

    function forEachModel(functionToApply) {
        _.each(modelsByTypeThenRef, function(models) {
            _.each(models, functionToApply);
        });
    }

    function add(model) {
        var rootType = context._getRootType(model.get('type'));
        var reference = model.get('reference');
        modelsByTypeThenRef[rootType] = modelsByTypeThenRef[rootType] || {};

        if (dx.core.util.isNone(reference)) {
            dx.fail('Can not cache a model with no reference (type is: ' + model.get('type') + ').');
        }

        modelsByTypeThenRef[rootType][reference] = model;
    }

    // typeName is optional
    function get(reference, typeName) {
        if (_.isUndefined(typeName)) {
            var result;
            _.find(modelsByTypeThenRef, function(models) {
                return _.find(models, function(model, modelReference) {
                    if (modelReference === reference) {
                        result = model;
                        return true;
                    }
                });
            });
            return result;
        } else {
            return modelsByTypeThenRef[typeName] ? modelsByTypeThenRef[typeName][reference] : undefined;
        }
    }

    function remove(model) {
        var rootType = context._getRootType(model.get('type'));
        var reference = model.get('reference');
        modelsByTypeThenRef[rootType] = modelsByTypeThenRef[rootType] || [];
        model.off(undefined, undefined, context);

        delete modelsByTypeThenRef[rootType][reference];

        if (_.isEmpty(modelsByTypeThenRef[rootType])) {
            delete modelsByTypeThenRef[rootType];
        }
    }

    function hasModel(reference) {
        return !!get(reference);
    }

    /*
     * Forcibly remove all models
     */
    function reset() {
        var toRemove = [];

        forEachModel(function(model) {
            toRemove.push(model);
        });

        _.each(toRemove, remove);
    }

    /*
     * Remove all models that have no more listeners
     */
    function prune() {
        var toRemove = {};

        forEachModel(function(model, reference) {
            var events = model._events || {};
            /*
             * Our model creation system currently sets up listeners on badReference and change.  If a model has
             * only one listener for each event, we want to ignore them when we consider whether the model has any
             * listeners that should prevent it from being pruned. (we don't mind pruning something that only has
             * listeners set up by the model creation system)
             */
            var hasCachingListeners = events.badReference && events.badReference.length === 1 &&
                events.change && events.change.length === 1;
            var listeners = hasCachingListeners ? _.omit(events, ['badReference', 'change']) : events;

            if (_.isEmpty(listeners)) {
                toRemove[reference] = model;
            }
        });

        _.each(toRemove, remove);
    }

    /*
     * Returns:
     *    true: If the store has no models
     *    false: if the store has one or more models
     */
    function isEmpty() {
        return _.isEmpty(modelsByTypeThenRef);
    }

    /*
     * Write out the models.
     */
    function dump() {
        dx.info('SERVER MODELS');
        dx.info('=============');
        dx.info(modelsByTypeThenRef);
    }

    function dumpText() {
        dx.info('SERVER MODELS');
        dx.info('=============');
        if (_.isEmpty(modelsByTypeThenRef)) {
            dx.info('None.');
        }
        var types = _.keys(modelsByTypeThenRef);
        _.each(types.sort(), function(typeName) {
            dx.info(typeName);
            dx.info('-------------');
            var references = _.keys(modelsByTypeThenRef[typeName]);
            _.each(references.sort(), function(reference) {
                var model = modelsByTypeThenRef[typeName][reference];
                dx.info(reference);
                dumpEventListners(model);
            });
        });
    }

    return {
        _models: modelsByTypeThenRef,
        add: add,
        get: get,
        remove: remove,
        hasModel: hasModel,
        reset: reset,
        dump: dump,
        prune: prune,
        isEmpty: isEmpty,
        dumpText: dumpText
    };
}

/*
 * This portion of the data system provides a cache of models and subscribers, collections and notification listeners.
 * It ensures that models are unique (that is, there is only one instance for a particular reference), it makes sure
 * all collections contain the models that they legitimately could contain, and subscribers are notified of new
 * models.
 *
 * There are four primary uses:
 *   - Someone retrieves data from the server. It would call getCachedModelFromProperties() which will create or update
 *     a model using those properties, and return the model to the caller.
 *   - Someone wants to retrieve a particular model. It calls getCachedModel(), which returns the requested model (and
 *     does a fetch on it, if necessary)
 *   - Someone wants to get a singleton: so it calls getCachedSingleton() which returns the unique singleton instance.
 *   - Someone wants a collection or notification subscribers of a particular type. They create the data structure
 *     and call _modelSubscribersStore.add to make sure the subscribers gets notified of changes and collections
 *     updated.
 *
 * This entire cache system is 'private' to the data system, and should not be called from outside.
 *
 * Unless reset() is called, at this time models and collections are never discarded.
 *
 * As with other parts of the data system, this takes a 'context' object, and attaches a _cache object to that one,
 * where private (to the data system) caching routines reside. The intent here is to make sure that if needed multiple
 * data systems can co-exist.
 */
dx.core.data._initCache = function(context) {
    /*
     * Return a singleton of the specified type. If it doesn't already exist, a new model is created, cached, and
     * returned.  If 'update' is true, then this will fetch new data for the model.
     * typeName:   The type of the singleton
     * options:    JSON object with these optional properties:
     *               update: {true|false}  Will cause an update (fetch) on the model
     *               success: A function to call when the model is ready
     *               error: A function to call when an error occurred during a fetch
     */
    function getCachedSingleton(typeName, options) {
        if (!_.isString(typeName)) {
            dx.fail('A type name must be passed to get the singleton.');
        }
        options = options || {};
        var model;
        var isNew;
        if (context._singletonStore.hasType(typeName)) {
            model = context._singletonStore.get(typeName);
            if (options.success) {
                options.success(model);
            }
        } else {
            var schema = assertTypeAndGetModelSchema(typeName);

            if (!schema.singleton) {
                dx.fail(typeName + ' is not a singleton.');
            }

            model = context._newServerModel(typeName);
            context._singletonStore.add(model);
            isNew = true;
        }

        if (options.update || isNew) {
            var fetchOpts = options;
            if (isNew) {
                fetchOpts = {
                    success: options.success,
                    error: function(result) {
                        context._singletonStore.remove(model);
                        if (options.error) {
                            options.error(result);
                        } else if (!options.suppressDefaultErrorHandler) {
                            context.reportErrorResult(result);
                        }
                    }
                };
            }
            model._dxFetch(fetchOpts);
        }

        return model;
    }

    /*
     * Given a set of properties, either update an existing model with the same reference as in the properties
     * object, or create a new server model, populate it with these properties, cache it and return it.
     *
     * properties: A JSON object containing properties that can be set() on a DSB model
     * options:    Backbone options
     */
    function getCachedModelFromProperties(properties, options) {
        var model;

        if (!_.isObject(properties) || !_.isString(properties.type)) {
            dx.fail('Must be called with an object that has a type property that is a string value.');
        }

        if (!context._modelConstructors[properties.type]) {
            dx.fail('Don\'t know how to create a model of type ' + properties.type + '.');
        }

        // Not all types have a reference property. Those that do not are not cachable. Assume this is a client model
        if (!isTypeCachable(properties.type) || dx.core.util.isNone(properties.reference)) {
            model = context._newClientModel(properties.type);
            model._dxSet(properties);
            return model;
        }

        var rootType = context._getRootType(properties.type);
        model = context._modelStore.get(properties.reference, rootType);
        if (_.isUndefined(model)) {
            model = makeModel(properties, properties.type, rootType);
            model._dxMakeReady();
            addModel(model, rootType, options);
        } else {
            model._dxSet(properties);
        }

        return model;
    }

    /*
     * Returns a cached model with the specified reference.  If the model isn't in the cache, this will return
     * a new model, which it will also fetch. If the update argument is true, it will be
     * fetched regardless of whether it is new or old.
     *
     * reference:  The reference of the model to retrieve
     * typeName:   The type of the model @@@@ why isn't this the root type?
     * options:    JSON object with these optional properties:
     *               update: {true|false}  Will cause an update (fetch) on the model
     *               cacheOnlyIfNeeded: {true|false} Add to the cache (and return) only if there are already
     *                  collections that would use it.
     *               suppressDefaultErrorHandler: {true|false} Do not trigger the default error handler on dxFetch
     */
    function getCachedModel(reference, typeName, options) {
        if (!_.isString(reference) || !_.isString(typeName)) {
            dx.fail('A reference and a type must be passed to get the model.');
        }
        options = options || {};

        var isNew = false;
        var rootType = context._getRootType(typeName);
        var mustCache = !options.cacheOnlyIfNeeded;
        var haveSubscriptionWhichNeedsModel = (context._modelSubscribersStore.getAllOfType(rootType).length !== 0);
        var addToCache = mustCache || haveSubscriptionWhichNeedsModel;

        var model = context._modelStore.get(reference, rootType);
        if (_.isUndefined(model) && addToCache) {
            model = makeModel({ reference: reference }, typeName, rootType);
            isNew = true;
        }

        if (model && (options.update || isNew)) {
            model._dxFetch({
                success: function() {
                    if (isNew) {
                        addModel(model, rootType);
                    }
                },
                error: function(result) {
                    if (isNew) {
                        context._modelStore.remove(model);
                    }
                    if (!options || !options.suppressDefaultErrorHandler) {
                        context.reportErrorResult(result);
                    }
                }
            });
        }

        return model;
    }

    /*
     * Returns true if the cache contains a model with the specified reference
     */
    function containsCachedModel(reference, typeName) {
        if (!_.isString(reference) || !_.isString(typeName)) {
            dx.fail('A reference and a type must be passed to check on the model.');
        }

        return !_.isUndefined(context._modelStore.get(reference, context._getRootType(typeName)));
    }

    /*
     * Deletes the model. This means removing it from the cache, as well as from any
     * collections that contain it, and clears the model's properties.
     * If the dontTriggerDelete flag is not set, this will also trigger a 'delete' event on the model.
     */
    function deleteCachedModel(reference, typeName, dontTriggerDelete) {
        if (!_.isString(reference) || !_.isString(typeName)) {
            dx.fail('A reference and a type must be passed to delete a model.');
        }

        var rootType = context._getRootType(typeName);
        var doomed = context._modelStore.get(reference, rootType);
        if (!doomed) {
            return;
        }

        _.each(context._modelSubscribersStore.getAllOfType(rootType), function(subscriber) {
            if (subscriber instanceof Backbone.Collection) {
                subscriber._dxRemoveModel(doomed);
            }
        });

        if (!dontTriggerDelete) {
            doomed.trigger('delete', doomed);
        }
        doomed.off(null, null, context);
        context._modelStore.remove(doomed);
        doomed._dxClear();
        doomed._dxDeleted = true;
    }

    /*
     * Remove all references we have to both singletons and server models.
     */
    function resetCache() {
        context._modelSubscribersStore.reset();
        context._singletonStore.reset();
        context._modelStore.reset();
    }

    /*
     * Dump the types (for singletons) and references (for server models) as text for all objects in the cache.
     */
    function dumpCacheAsText() {
        context._modelSubscribersStore.dumpText();
        dx.info('');

        context._singletonStore.dumpText();
        dx.info('');

        context._modelStore.dumpText();
    }

    /*
     * Dump the internal singletons and model data structures.  This is usable on most browsers.
     */
    function dumpCache() {
        context._modelSubscribersStore.dump();
        dx.info('');

        context._singletonStore.dump();
        dx.info('');

        context._modelStore.dump();
        dx.info('');
    }

    function prune() {
        context._modelSubscribersStore.prune();
        context._singletonStore.prune();
        context._modelStore.prune();
    }

    function isEmpty() {
        return context._modelSubscribersStore.isEmpty() &&
            context._singletonStore.isEmpty() &&
            context._modelStore.isEmpty();
    }

    /*
     * Creates a model, sticks it in the cache, and sets up to cope with badReferences
     */
    function makeModel(properties, typeName, rootType) {
        var model = context._newServerModel(typeName);
        model._dxSet(properties);
        context._modelStore.add(model);
        model.on('badReference', function handle404() {
            deleteCachedModel(properties.reference, rootType, true);
        }, context);

        return model;
    }

    /*
     * Adds the specified model to the collections
     */
    function addModel(model, rootType, options) {
        /*
         * Recheck whether the model should be added to collections any time it changes.
         * This does not apply for subscribers which only need to be notified once for each object.
         */
        model.on('change', function updateCollections() {
            notifySubscriptionsOfModelChanged(model, rootType);
        }, context);
        notifySubscriptionsOfModel(model, rootType, options);
    }

    /*
     * Adds the specified model to all relevant subscribers (collections or notification listeners).
     */
    function notifySubscriptionsOfModel(model, rootType, options) {
        _.each(context._modelSubscribersStore.getAllOfType(rootType), function(subscriber) {
            subscriber._dxAddOrRemove(model, options);
        });
    }

    /*
     * Notifies collections that the model has changed.
     */
    function notifySubscriptionsOfModelChanged(model, rootType, options) {
        _.each(context._modelSubscribersStore.getAllOfType(rootType), function(subscriber) {
            if (subscriber instanceof Backbone.Collection) {
                subscriber._dxAddOrRemove(model, options);
            }
        });
    }

    /*
     * Asserts that the type is a valid model type, and returns its schema.
     */
    function assertTypeAndGetModelSchema(typeName) {
        var ModelConstructor = context._modelConstructors[typeName];

        if (!ModelConstructor) {
            dx.fail(typeName + ' is not a known type name.');
        }

        return ModelConstructor.prototype._dxSchema;
    }

    /*
     * Examines the type, and returns a truthy value if it is cachable
     */
    function isTypeCachable(type) {
        var Constructor = context._modelConstructors[type];
        if (!Constructor) {
            return false;
        }
        var typeDef = Constructor.prototype._dxSchema;
        var propDefs = typeDef.properties || {};

        return !!propDefs.reference;
    }

    context._modelSubscribersStore = new ModelSubscriberStore();
    context._singletonStore = new SingletonStore();
    context._modelStore = new ModelStore(context);

    /*
     * Make all of our public routines available.
     */
    context._cache = {
        _ModelSubscriberStore: ModelSubscriberStore,
        _SingletonStore: SingletonStore,
        _ModelStore: ModelStore,
        getCachedSingleton: getCachedSingleton,
        getCachedModelFromProperties: getCachedModelFromProperties,
        getCachedModel: getCachedModel,
        deleteCachedModel: deleteCachedModel,
        containsCachedModel: containsCachedModel,
        reset: resetCache,
        dumpText: dumpCacheAsText,
        dump: dumpCache,
        prune: prune,
        isEmpty: isEmpty,
        isTypeCachable: isTypeCachable
    };
};

})();

},{}],4:[function(require,module,exports){
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
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global dx, $, _, Backbone */

'use strict';

dx.namespace('dx.core.data');

(function() {
/*
 * This takes a set of schemas (modified by _prepareSchemas), and creates a set of Backbone Collection constructor
 * functions (and, by implication, functionality upon the collections generated by those functions). These will be
 * used by the 'level3' API's to provide final collections to consumers of the data layer.
 *
 * See the comment for level2-models for a list of the specialized terminology used here (e.g. DSB).
 *
 * CONSTRUCTOR FUNCTIONS
 * The collections created by these constructor functions contain groups of DSB Models that all share a common parent
 * type.  These collections can only have their contents changed by way of $$list() operations and the notification
 * system. Unlike DSB models, there are no 'Client' collections.  To have a fully-alterable collection of models,
 * use an ordinary Backbone Collection.
 *
 * EVENTS
 * ready : readyHandler(collection)
 * If you want to know if a collection is ready to be used (has retrieved at least one set of results via $$list()),
 * use the 'ready' event, which is unique to DSB collections.
 * Ready indicates that the collection has retrieved an initial set of models.  Unlike ordinary events, if a ready
 * handler is assigned to a collection that is already ready, that handler (and no others) will be triggered
 * immediately. Ready handlers receive as their first (and only) argument the
 *
 * dirty : dirtyHandler(collection)
 * Indicates that the collection may be out of sync with the server and should be re-$$list()'ed
 *
 * POPULATION
 * Server collections are populated in two ways:
 *   1) A call to $$list() will fill the collection with the current set of models from the server
 *   2) The notification system, if enabled, may cause models to be added and removed from the collection at any time.
 * The operation of $$list() is straightforward.  Notifications are a little less clear.  As the notification system
 * learns of object changes, it will inform the caching system about the changes.  That, in turn will cause the
 * caching system to try to update any collections, adding and removing those models to collections as needed.
 * The decision of whether a model should be added will depend on the query parameters that currently govern the
 * collection (the ones last passed to $$list(), if any).  In some cases, a collection may have a paged set of results,
 * and at that point it can be difficult to determine whether the model should be added to the collection.
 * The filter system (level2-filter) provides per-type filters. It is their responsibility to determine how the model
 * should be dealt with. If it can't determine (as in the case with paging), the collection will trigger a 'dirty'
 * event, which the client of the collection can use to decide how to handle this case. If setAutoPageRefresh(true) has
 * been called on the collection, then in these circumstances, in addition to firing the 'dirty' event, the collection
 * will automatically re-call $$list() with the original query parameters. In this case, the original success and error
 * handlers will be called again after the list operation returns.
 *
 * OPERATIONS
 * The collections created by these constructor functions have these similarities and differences compared to the
 * standard Backbone collections.
 *
 * Standard Backbone properties (none of these should be changed)
 *     models     : -- : The set of models in the collection. Don't access directly. Use at() instead.
 *     length     :    : Standard behavior.
 *
 * Standard Backbone functions
 *     model      : -- : Must not use. Collections can not create their own models.
 *     toJSON     :    : Standard behavior.
 *     Underscore :    : Standard behavior. These are the 'underscore' functions can all be applied to collections.
 *     add        : -- : Do not use. Use $$list() instead.
 *     remove     : -- : Do not use. Use $$list() instead.
 *     reset      : -- : Do not use. Use $$list() instead.
 *     set        : -- : Do not use. Use $$list() instead.
 *     get        :    : Standard behavior.
 *     at         :    : Standard behavior.
 *     push       : -- : Do not use. Use $$list() instead.
 *     pop        : -- : Do not use. Use $$list() instead.
 *     unshift    : -- : Do not use. Use $$list() instead.
 *     shift      : -- : Do not use. Use $$list() instead.
 *     slice      :    : Standard behavior.
 *     comparator :    : Standard behavior.
 *     sort       :    : Standard behavior.
 *     pluck      :    : Standard behavior.
 *     where      :    : Standard behavior.
 *     findWhere  :    : Standard behavior.
 *     url        : -- : Internal use. Don't use.
 *     parse      : -- : Internal use. Don't use. Handles return values from the Delphix Engine
 *     clone      :    : Standard behavior. However, the returned collection is an ordinary Backbone Collection.
 *     fetch      : -- : Do not use. Use $$list() instead.
 *     create     : -- : Do not use. DSB Models have more complex creation semantics. use rootOps..$$create().
 *
 * DSB Collection functions
 *     $$list             :    : Populates the collection with a selection of models from the server.
 *     getQueryParameters :    : Returns the query parameters used to populate this collection via $$list
 *     clear              :    : Removes all models from the collection, empties any query parameters, and blocks any
 *                               models from being auto-added until another $$list is issued
 *
 * Private to dxCore Data
 *     context._collectionConstructors : The set of collection constructor functions
 *     context._newServerCollection    : Creates a new Server Collection
 *
 * Parameters:
 *     schemas: The set of schemas this should generate constructors from.
 *     context: The object to put the resulting constructors (_collectionConstructors) on. If not specified, puts them
 *              on 'this'.
 */
dx.core.data._generateCollectionConstructors = function(schemas, context) {
    var LISTINGMODE_IDLE = 0;
    var LISTINGMODE_LISTING = 1;

    /*
     * ========================================
     * Collection functions
     * ========================================
     */

    /*
     * Backbone defines this as: Bind a callback function to an object. The callback will be invoked whenever the event
     * is fired.
     *
     * For DSB collections, we provide standard behavior for this, but do some special processing if someone is
     * listening for the 'ready' event. In that case, if we have done a $$list() successfully, then we trigger the
     * ready event immediately.
     */
    function dxOn(name, callback, context) {
        Backbone.Events.on.call(this, name, callback, context);
        if (name === 'ready' && this._dxIsReady) {
            this.trigger('ready', this);
        } else if (name === 'error' && this._dxIsErrored) {
            this.trigger('error', this);
        }
    }

    /*
     * Backbone defines this as: [This] performs a 'smart' update of the collection with the passed list of models.
     *
     * In general, we do not allow this to be called, since server models are supposed to be read only. However,
     * in some cases, internally, we need to add models to the collection, and wish to partake of the functionality
     * already defined by Backbone. So, if this is called with { _dxAllowSetPassthrough:true }, it will call
     * Backbone.Collection.set() normally.
     *
     * This is not simply a dxAdd function, since we need to support calls from within backbone back to model.set()
     * that may have been triggered by other actions we have taken.
     */
    function dxSet(models, options) {
        options = options || {};
        if (!options._dxAllowSetPassthrough) {
            operationNotAllowed();
        }

        assertModelsCompatible(models, this);
        return Backbone.Collection.prototype.set.call(this, models, _.extend(options, {
            merge: false,
            remove: false
        }));
    }

    /*
     * Backbone defines this as: parse is called by Backbone whenever a collection's models are returned by the server,
     * in fetch. The function is passed the raw response object, and should return the array of model attributes to be
     * added to the collection. The default implementation is a no-op, simply passing through the JSON response.
     * Override this if you need to work with a preexisting API, or better namespace your responses.
     *
     * This expects the response to always have a type attribute. If it is an ErrorResult, it gets reported through the
     * standard error handler. If it is a ListResult, we return just the result array. Otherwise we throw an error.
     */
    function dxParse(response) {
        if (!response || !response.type) {
           dx.fail('Got a response without a type.');
        } else if (response.type !== 'ListResult') {
            dx.fail('Got an unexpected type of response (' + response.type + ') in parse().');
        }

        return response.result;
    }

    /*
     * Entirely block the standard Backbone fetch() routine. We want users to call $$list(), as that has a more
     * constrained API, better matches the api we're providing for operations and rootOperations, and, more directly
     * maps to our schemas.
     */
    function dxFetch() {
        dx.fail('Do not call fetch() directly. Instead, call $$list().');
    }

    /*
     * Entirely block the standard Backbone create() routine. Creation is more complex for DSB models, and so should be
     * done through the $$create operations.
     */
    function dxCreate() {
        dx.fail('Do not call create() directly. Instead, call rootOps.' + this._dxInfo.baseType + '.$$create().');
    }

    /*
     * Removes all models from the collection, but leaves it 'live'.  This is used for testing purposes.
     */
    function dxEmpty() {
        Backbone.Collection.prototype.remove.call(this, this.models, {silent: true});
    }

    /*
     * Removes all models from the collection (not silently), removes the query parameters,
     * if any, and marks the collection as not ready, which means it must have another $$list() call in order to get
     * new models
     */
    function dxClear() {
        this._dxIsReady = false;
        this._queryParameters = undefined;
        Backbone.Collection.prototype.remove.call(this, this.models, {silent: true});
        this.trigger('reset', this);
    }

    /*
     * Given a model, this will either add it to the collection, if it should be in the collection, ignore it if it
     * shouldn't be in the collection (and isn't there already), or remove it if it shouldn't be in the collection and
     * is.  This takes into account any query parameters associated with the collection, and uses collection filters
     * if defined.
     *
     * Note that models can be neither added nor removed if this is not ready.
     */
    function dxAddOrRemove(model, options) {
        assertModelsCompatible(model, this);
        if (!this._dxIsReady) {
            return;
        }
        options = _.extend({
                _dxAllowSetPassthrough: true
            }, options);
        var self = this;
        var rootType = this._dxInfo.baseType;

        if (self._listingMode === LISTINGMODE_LISTING) {
            return;
        }

        var filter = context._filters[rootType];
        if (!filter) {
            if (self._dxInfo.paramDefs.dxFilterMode === dx.core.constants.LIST_TYPES.NONE) {
                dxSet.call(self, model, options);
                return;
            }

            filter = context._filters._uberFilter;
        }

        filter(this, model, function(placement) {
            if (model._dxDeleted) {
                /*
                 * Since some filters use asynchronous requests to determine the inclusion of an object,
                 * it is possible for an object to be deleted while a filter is executed.
                 * We need to make sure that even if the filter determines that the object should be
                 * included in the list, the collection discards deleted objects.
                 */
                return;
            }
            switch (placement) {
                case context._filters.INCLUDE:
                    dxSet.call(self, model, options);
                    break;
                case context._filters.EXCLUDE:
                    self._dxRemoveModel(model, options);
                    break;
                case context._filters.UNKNOWN:
                    if (self._listingMode === LISTINGMODE_IDLE) {
                        triggerDirty(self);
                    }
                    break;
                default:
                    dx.fail('Filter returned an invalid value.');
            }
        });
    }

    /*
     * Sets the autoPageRefresh property.
     */
    function setAutoPageRefresh(value) {
        this._autoPageRefresh = value;
    }

    /*
     * Return the autoPageRefresh property.
     */
    function getAutoPageRefresh() {
        return this._autoPageRefresh;
    }

    /*
     * Remove the models from this collection that are being obsoleted by the contents of the rawPropsArray. In
     * general, we remove the models that the collection currently contains that are not part of the rawPropsArray,
     * but if the rawPropsArray don't have a reference attribute, then we can't tell if the models are the same or not
     * so we reset.
     *
     * Return whether we are resetting the collection. This is true if we're removing all elements, or if
     * collection._resetOnList is true.
     */
    function removeUnneededModels(collection, rawPropsArray) {
        var resetting = false;

        if (rawPropsArray.length !== 0 && _.isUndefined(rawPropsArray[0].reference)) {
            Backbone.Collection.prototype.remove.call(collection, collection.models, {silent: true});
            resetting = true;
        } else {
            var newReferences = _.map(rawPropsArray, function(attributes) {
                return attributes.reference;
            });

            // Figure out which models to remove (by reference). reset if removing all
            var modelsToRemove = [];
            collection.each(function(model) {
                if (!_.contains(newReferences, model.id)) {
                    modelsToRemove.push(model);
                }
            });

            if (collection._resetOnList || modelsToRemove.length === collection.length) {
                resetting = true;
            }

            _.each(modelsToRemove, function(model) {
                Backbone.Collection.prototype.remove.call(collection, model, {silent: resetting});
            });
        }
        return resetting;
    }

    /*
     * Retrieve a set of models from the server, entirely replacing the contents of this collection with those models.
     * This is a reflection of the list standard operation found in Delphix schemas.  This takes a set of query
     * parameters as an argument, and will populate the collection with the results of that query.
     *
     * Note that if multiple requests are issued, this will only honor the last request sent. Models are added/removed
     * only when the last issued request returns. This also means that ready/error events are triggered and promises
     * resolved/rejected only once the last request issued returns.
     *
     * Parameters:
     *     parameters: An object hash containing the parameters to this list operation. For example, if this is a
     *         Container collection, you might call
     *             myCollection.$$list({
     *                 group: 'GROUP-1',
     *                 parent: 'CONTAINER-23'
     *             });
     *     successError: A standard object that contains a success and/or error callback routine.
     * Events:
     *     ready:  Triggered for the collection once all the models have been added and removed. Handler argument is
     *             the collection.
     *             Also triggered for each model marked as ready. Handler argument is a model.
     *     reset:  Triggered if this results in all the existing models being removed, or the _resetOnList flag has
     *             been set to true. Argument is the collection.
     *     remove: Triggered for each model removed, iff only some of the models are removed. Argument is the model.
     *     add:    Triggered for each added model, iff only some of the models were removed. Argument is the model.
     */
    function dxList(parameters, successError) {
        var sendableParams = context._checkAndConvertParameters(parameters, this._dxInfo.paramDefs.parameters);
        var self = this;
        var rootType = this._dxInfo.baseType;

        // No filter function. Complain so someone writes one, and blindly add the model
        if (dx.core.util.isNone(context._filters[rootType]) &&
            self._dxInfo.paramDefs.dxFilterMode === dx.core.constants.LIST_TYPES.CUSTOM) {
            dx.fail('No filter function found for collections of type ' + rootType + '. Add one to ' +
                 ' dx.core.data._filters. In the mean time, all models will be added to the collection.');
        }

        self._dxIsReady = false;
        self._dxIsErrored = false;
        // Keep track of latest outstanding request. We only honor a response if it came from the latest issued request.
        self._latestListToken++;
        var currListToken = self._latestListToken;

        self.sync('read', self, {
            parse: true,
            data: sendableParams,
            success: function(resp) {
                if (self._latestListToken !== currListToken) {
                    return; // Another list request has been issued
                }

                if (resp && resp.type === 'ErrorResult') {
                    var processedResult = context._newClientModel(resp.type);
                    processedResult.set(resp);
                    if (successError && successError.error) {
                        successError.error(processedResult);
                    } else {
                        context.reportErrorResult(processedResult);
                    }
                    self.trigger('error', self);
                    self._dxIsErrored = true;
                    return;
                }

                var resetting = false;
                self._queryParameters = dx.core.util.deepClone(parameters);
                self._listSuccessError = successError; // save for auto-relisting
                self._dxIsReady = true;
                self._listingMode = LISTINGMODE_LISTING;

                resp = self.parse(resp);

                resetting = removeUnneededModels(self, resp) || self._resetOnList;

                /*
                 * Add the new models.
                 */
                _.each(resp, function(attributes) {
                    var model = context._cache.getCachedModelFromProperties(attributes, {silent: resetting});
                    dxSet.call(self, model, {silent: resetting, _dxAllowSetPassthrough: true});
                });

                self._listingMode = LISTINGMODE_IDLE;

                // Report finishing events
                if (resetting) {
                    self.trigger('reset', self);
                }

                self.trigger('ready', self);

                if (successError && successError.success) {
                    successError.success();
                }
            },
            error: function(xhr) {
                if (self._latestListToken !== currListToken) {
                    return; // Another list request has been issued
                }
                var errorResult = context._convertXhrToErrorResult(xhr);
                context._handleErrorResult(errorResult, successError);
                self.trigger('error', self);
                self._dxIsErrored = true;
            }
        });

        // Return a promise that is resolved once the model is ready, and rejected if the model reports an error
        var deferred = new $.Deferred();
        var listenerContext = {};

        self.once('ready', function() {
            deferred.resolve(self);
            self.off(undefined, undefined, listenerContext);
        }, listenerContext);

        // don't set up the error handler if ready was already triggered
        if (deferred.state() === 'pending') {
            self.once('error', function() {
                deferred.reject(self);
                self.off(undefined, undefined, listenerContext);
            }, listenerContext);
        }

        return deferred.promise();
    }

    /*
     * Retrieve the last set of query parameters passed to $$list().  This is useful if you want to see what this
     * collection currently contains.
     */
    function getQueryParameters() {
        return this._queryParameters;
    }

    /*
     * ========================================
     * Collection creation
     * ========================================
     */

    /*
     * Returns a new DSB collection which is set to be a server collection.
     *
     * resetOnList: If true, $$list()'s will only trigger a single 'reset' event rather than individual 'add' and
     *              'remove' events. Otherwise this happens only when the $$list() fully replaces the contents of the
     *              collection.
     */
    function newServerCollection(typeName, resetOnList) {
        if (dx.core.util.isNone(typeName)) {
            dx.fail('To create a new collection, a type name must be provided.');
        }

        if (!isSchemaType(typeName)) {
            dx.fail(typeName + ' is not a known type with a list operation. Can not create this collection.');
        }

        var collection = new context._collectionConstructors[typeName]();
        collection.constructor = Backbone.Collection.extend(); // make clone() return an ordinary backbone collection.
        collection._resetOnList = !!resetOnList;

        return collection;
    }

    function operationNotAllowed() {
        dx.fail('Can not call this operation on a Server Collection.');
    }

    /*
     * ========================================
     * Utility functions
     * ========================================
     */

    function isSchemaType(typeName) {
        return !!context._collectionConstructors[typeName];
    }

    /*
     * Return true if the type is the same as baseType or is a subtype.
     */
    function isACompatibleType(type, baseType) {
        if (!context._modelConstructors[type]) {
            return false;
        }

        var typeDef = context._modelConstructors[type].prototype._dxSchema;
        while (typeDef) {
            if (typeDef.name === baseType) {
                return true;
            }
            typeDef = typeDef.parentSchema;
        }

        return false;
    }

    /*
     * Throws error if model (Backbone.Model or attributes) is not compatible with the specified type.
     */
    function assertModelCompatible(aModel, baseType) {
        var type;
        if (aModel instanceof Backbone.Model) {
            type = aModel.get('type');
        } else {
            dx.fail('Can not add an arbitrary set of attributes. Must pass a Backbone Model.');
        }

        if (!isACompatibleType(type, baseType)) {
            dx.fail('Can not add a model of type ' + type + ' to a collection with a base type of ' + baseType + '.');
        }
    }

    /*
     * Validates that all models are compatible with this collection's type.
     */
    function assertModelsCompatible(models, referenceModel) {
        if (dx.core.util.isNone(models)) {
            dx.fail('Can not call without a model.');
        }

        if (_.isArray(models)) {
            _.each(models, function(model) {
                assertModelCompatible(model, referenceModel._dxInfo.baseType);
            }, this);
        } else {
            assertModelCompatible(models, referenceModel._dxInfo.baseType);
        }
    }

    /*
     * Trigger a 'dirty' event, and if appropriate, set up another call to do a new list operation.
     */
    function triggerDirty(collection) {
        collection.trigger('dirty');
        if (collection.getAutoPageRefresh()) {
            setTimeout(function() {
                dxList.call(collection, collection.getQueryParameters(), collection._listSuccessError);
            }, 0);
        }
    }

    /*
     * ========================================
     * Actually do the work of this function
     * ========================================
     */

    context = context || this;
    context._collectionConstructors = context._collectionConstructors || {};

    _.each(schemas, function(schema, typeName) {
        if (schema.list) {
            // examine return values, in case the return type is not the same as the schema type
            var retObj = schema.list.return;
            var retItemsObj = retObj ? retObj.items : undefined;
            var collectionType = retItemsObj  ? retItemsObj.$ref : (retObj || {}).$ref;
            collectionType = collectionType || schema.name;

            context._collectionConstructors[typeName] = Backbone.Collection.extend({
                _dxInfo: {
                    baseType: collectionType,
                    paramDefs: schema.list
                },
                _dxIsReady: false,
                _dxIsErrored: false,
                _queryParameters: undefined,
                _autoPageRefresh: false,
                _listSuccessError: undefined,
                _listingMode: LISTINGMODE_IDLE,
                url: schema.root,
                _dxEmpty: dxEmpty,
                _dxRemoveModel: Backbone.Collection.prototype.remove,
                _dxAddOrRemove: dxAddOrRemove,
                model: function() {
                    dx.fail('Can not create a new model on a collection. Must use the cache.');
                },
                on: dxOn,
                add: operationNotAllowed,
                remove: operationNotAllowed,
                set: dxSet,
                reset: operationNotAllowed,
                push: operationNotAllowed,
                pop: operationNotAllowed,
                unshift: operationNotAllowed,
                shift: operationNotAllowed,
                parse: dxParse,
                fetch: dxFetch,
                create: dxCreate,
                $$list: dxList,
                _latestListToken: 0,
                _resetOnList: false,
                clear: dxClear,
                getQueryParameters: getQueryParameters,
                setAutoPageRefresh: setAutoPageRefresh,
                getAutoPageRefresh: getAutoPageRefresh
            });
        }
    });

    context._newServerCollection = newServerCollection;
};

})();

},{}],5:[function(require,module,exports){
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
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global dx, _ */

'use strict';

dx.namespace('dx.core.data');

(function() {

/*
 * Creation listeners provide access to notification updates for API server objects creation in the form
 * of level2 models.
 *
 *   typeName         The schema type for which one receives notifications.
 *
 *   callback         A function to be invoked with a level2 model as argument for each create notification.
 *
 *   queryParams      Optional query parameters used to filter notifications.
 *
 *   context          The context to access other dxData content (cache, filters).
 */
function CreationListener(settings) {
    var self = this;
    if (dx.core.util.isNone(settings.typeName)) {
        dx.fail('To create a new creation listener, a type name must be provided.');
    }
    var typeName = settings.typeName;
    var context = settings.context;
    if (!isListableType(typeName, context)) {
        dx.fail(typeName + ' is not a known type with a list operation. Can not create this creation listener.');
    }
    if (!_.isFunction(settings.callback)) {
        dx.fail('Callback must be provided as a function.');
    }

    self._dxInfo = {
        baseType: settings.typeName
    };

    self.inUse = true;

    self.getQueryParameters = function() {
        return settings.queryParams;
    };

    // The format must remain compatible with level2-collections and level2-cache.
    self._dxAddOrRemove = function(model) {
        if (!self.inUse) {
            return;
        }

        context._filters[typeName](self, model, function(placement) {
            switch (placement) {
                case context._filters.INCLUDE:
                    settings.callback(model);
                    break;
                case context._filters.EXCLUDE:
                    break;
                case context._filters.UNKNOWN:
                    dx.fail('UNKNOWN filter result not supported by creation listeners');
                    break;  // to keep ant check happy.
                default:
                    dx.fail('Filter returned an invalid value.');
            }
        });
    };

    self.dispose = function() {
        self.inUse = false;
    };
}

function isListableType(typeName, context) {
    return !!context._collectionConstructors[typeName];
}

_.extend(dx.core.data, {
    CreationListener: CreationListener
});

})();

},{}],6:[function(require,module,exports){
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
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global dx, _, $, Backbone */

'use strict';

dx.namespace('dx.core.data');

/*
 * Defines general purpose filter routines. These can be used to build type-specific filters.
 *
 * A filter is simply a function that reproduces the server's treatment of the query parameters on the list operation
 * for any type.  Each filter function has the signature
 *    filterFunction(collection, model, resultHandler)
 * The filter function should examine the query parameters on the collection, then examine the properties of the model
 * and call resultHandler with a value indicating how the model should be placed with respect to the collection:
 *    INCLUDE: The model can be put in the collection
 *    EXCLUDE: The model should not be put in the collection (and removed if it is there already)
 *    UNKNOWN: The filter can't determine what to do with the model. Most likely the collection should be re-fetched
 * The potentially asynchronous call to resultHandler is necessary since some query parameters will require retrieval
 * of models to make their determination.
 */
(function() {

dx.core.data._initFilters = function(context) {
    var EXCLUDE = 'EXCLUDE';
    var INCLUDE = 'INCLUDE';
    var UNKNOWN = 'UNKNOWN';

    var DATE_PROPS = ['fromDate', 'startDate', 'toDate', 'endDate'];

    /*
     * Helper for non-generated filters. In many cases, the property in the query parameter is the same as that of the
     * attribute in the model. This means we can make a decision synchronously, which keeps the logic in the filters
     * simpler (compare to checkQueryParam(), which returns a promise).
     * This compares the value in the query parameter with that of the model.
     *
     * properties: An array of property names to compare
     * qParams:    The query parameters to compare
     * model:      The model to compare
     */
    function checkSameProps(properties, qParams, model) {
        var result = INCLUDE;

        _.each(properties, function(property) {
            if (_.has(qParams, property) && qParams[property] !== model.get(property)) {
                result = EXCLUDE;
            }
        });

        return result;
    }

    /*
     * When a model is being compared against a collection that has been retrieved with paging, then we can't reliably
     * tell whether the model belongs in the collection. Note that this assumes not specifying a page size implicitly
     * sets it to a particular size (generally 25), while specifying 0 means 'all'
     */
    function checkPageSize(qParams) {
        if (!_.has(qParams, 'pageSize') || qParams.pageSize !== 0) {
            return UNKNOWN;
        }
        return INCLUDE;
    }

    /*
     * Helper function to check date-related query parameters. This assumes qParamName is a valid date property.
     * The caller is responsible for making sure that qParamName is one of DATE_PROPS
     */
    function checkDateProp(qParamVal, qParamName, qpSchema, model, attrName) {
        if (!_.has(qpSchema, 'inequalityType')) {
            dx.fail('Date property "' + qParamName + '" missing "inequalityType" schema property');
        }
        if (dx.core.util.isNone(model.get(attrName))) {
            return EXCLUDE;
        }

        if (_.contains(['fromDate', 'startDate'], qParamName)) {
            if (model.get(attrName).getTime() < qParamVal.getTime()) {
                return EXCLUDE;
            }
        } else if (model.get(attrName).getTime() > qParamVal.getTime()) { // toDate or endDate
            return EXCLUDE;
        }

        if (qpSchema.inequalityType === dx.core.constants.INEQUALITY_TYPES.STRICT &&
                model.get(attrName).getTime() === qParamVal.getTime()) {
            return EXCLUDE;
        }

        return INCLUDE;
    }

    /*
     * Helper for the uberFilter to check an individual query parameter against the model. This may involve
     * asynchronous ServerModel fetches to resolve 'mapsTo' data mapping chains. As a result this returns a promise to
     * the caller. At the moment this only deals with query params that may result in INCLUDE or EXCLUDE - never
     * UNKNOWN.
     * The returned promise is either resolved with INCLUDE or rejected with EXCLUDE.
     */
    function checkQueryParam(qParamVal, qParamName, model, rootSchemaDef) {
        var qpSchema = rootSchemaDef.list.parameters[qParamName],
            deferred = $.Deferred(),
            mapsTo = qpSchema.mapsTo;

        if (!mapsTo) {
            dx.fail('No mapsTo property found for query parameter ' + qParamName + '.');
        }

        var pathSegs = mapsTo.split('.');

        // We know the last seg will be property to compare. Anything before will be a chain of object references.
        var finalAttrName = pathSegs.pop();

        // Recursively walk the data mapping segments
        function followNextSeg(currModel) {
            currModel.once('error', deferred.reject);
            currModel.once('ready', function() {
                if (_.isEmpty(pathSegs)) {
                    // We've reached the end of the path. Do the actual check.
                    var result;

                    if (_.contains(DATE_PROPS, qParamName)) {
                        result = checkDateProp(qParamVal, qParamName, qpSchema, currModel, finalAttrName);
                    } else { // simple property check
                        result = currModel.get(finalAttrName) === qParamVal ? INCLUDE : EXCLUDE;
                    }

                    if (result === INCLUDE) {
                        deferred.resolve(result);
                    } else {
                        deferred.reject(result);
                    }
                } else {
                    // recursive case - continue following path segments.
                    var currPart = '$' + pathSegs.shift();
                    var newModel = currModel.get(currPart);
                    followNextSeg(newModel);
                }
            });
        }

        followNextSeg(model);

        return deferred.promise();
    }

    function getRootedSchema(model) {
        function upwardFind(schema, schemaName) {
            if (dx.core.util.isNone(schema)) {
                dx.fail('Malformed type. Root schema type not found.');
            }

            if (schema.name === schemaName) {
                return schema;
            }

            return upwardFind(schema.parentSchema, schemaName);
        }

        if (!model._dxSchema.rootTypeName) {
            dx.fail('Trying to filter a type that has no root type.');
        }

        return upwardFind(model._dxSchema, model._dxSchema.rootTypeName);
    }

    /*
     * This is the filter to rule all filters. It will filter models for a given collection based on the schema
     * definition and annotations. This may be used as a standalone filter or as a helper for another filter, usually
     * in conjunction with the 'skipParams' argument (see alertFilter).
     * The uberFilter can only handle 'standard' query parameters: simple equality checks, date comparisons, and
     * paging. Similarly there are instances of query parameters that the uberFilter should not attempt to handle.
     * These come in two flavors:
     * 1) Params that do not affect what comes back from the notification system are marked as 'excludeFromFilter' in
     *    the schemas.
     * 2) Params that require special handling can be passed to the uberFilter using the 'skipParams' array.
     */
    function uberFilter(collection, model, resultHandler, skipParams) {
        var qParams = collection.getQueryParameters() || {};
        var schemaDef = getRootedSchema(model);
        var listParams = schemaDef.list.parameters;

        // If the schema definition for list says there are no parameters, then the model can always be included
        if (_.isEmpty(schemaDef.list.parameters)) {
            resultHandler(INCLUDE);
        }

        qParams = _.omit(qParams, skipParams);

        /*
         * If a type could have pageSize, we may need to return UNKNOWN. Otherwise we can keep going in the filter.
         * Note that we don't care about paging params when dealing with creation listeners.
         */
        if (_.has(listParams, 'pageSize') && collection instanceof Backbone.Collection) {
            var pageSizeResult = checkPageSize(qParams);
            if (pageSizeResult === UNKNOWN) {
                return resultHandler(pageSizeResult);
            }
        }
        qParams = _.omit(qParams, ['pageSize', 'pageOffset']);

        if (_.isEmpty(qParams)) {
            return resultHandler(INCLUDE);
        }
        var promises = _.map(qParams, function(qParamVal, qParamName) {
            return checkQueryParam(qParamVal, qParamName, model, schemaDef);
        });

        /*
         * Wait until all query param checks have resolved to make a final decision. Params that might result in
         * UNKNOWN (paging and params we can't handle) are dealt with earlier. Therefore we know each of these promises
         * is either resolved with INCLUDE or rejected with EXCLUDE.
         */
        $.when.apply(undefined, promises)
            .then(function() {
                resultHandler(INCLUDE);
            })
            .fail(function() {
                resultHandler(EXCLUDE);
            });
    }

    /*
     * Simple filter for any type that doesn't actually have query parameters on its list operation (e.g. Group).
     */
    function genericFilter(collection, model, resultHandler) {
        resultHandler(INCLUDE);
    }

    /*
     * Do the real work.
     */
    context = context || this;
    context._filters = context._filters || {};

    _.extend(context._filters, {
        EXCLUDE: EXCLUDE,
        INCLUDE: INCLUDE,
        UNKNOWN: UNKNOWN,
        Notification: uberFilter,
        _checkSameProps: checkSameProps,
        _genericFilter: genericFilter,
        _uberFilter: uberFilter
    });
};

})();

},{}],7:[function(require,module,exports){
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

/*global dx, $, _, Backbone */

'use strict';

dx.namespace('dx.core.data');

(function() {

/*
 * This takes a set of schemas (modified by _prepareSchemas), and creates a set of Backbone Model constructor functions
 * (and, by implication, functionality upon the models). This also creates a set of 'root operation' functions.
 * The constructor functions will be used by the level 3 API's to provide final collections to consumers of dxCore Data.
 *
 * CONSTRUCTOR FUNCTIONS
 * The models created by these constructor functions provide access to the data types that the Delphix Server works with
 * and implicitly manage the network connections to the server to get their data and perform operations on them. That
 * is, when using the models created by these constructor functions, the caller can work with the data in the server's
 * terms, and can remain insulated from managing network communication.
 *
 * Terminology notes:
 *     Attributes:       Backbone calls the name/value pairs on a Model 'attributes'.
 *     Client Model:     A model which is created on the client, and generally doesn't reflect data that exists on the
 *                       server. Most commonly, these are either parameters to operations on Server Models, or return
 *                       values from operations. Client Models are not maintained by the notification system.
 *     DSB Model:        Delphix-Schema-Based Model.  The models produced by the constructor functions this creates.
 *                       These are Backbone models that are constrained and enhanced to fit our Delphix Schema
 *                       requirements.
 *     Embedded Model:   A model that is placed 'within' another model via a object/referenceTo property in the schema.
 *     Properties:       The name/value pairs on an ordinary Javascript/JSON/JSON-Schema object are called 'properties'.
 *     Referenced Model: A model that is referenced via a string/objectReference property in another.
 *     Server Model:     A model which represents a corresponding object on the server.  These models may not be
 *                       modified from outside of the dxCore Data, since they are guaranteed to remain accurate and up
 *                       to date with the server's objects (as long as they are left inside of a collection)
 *
 * This routine (which should only be called from within the data system) consumes the schemas and creates a set of
 * Backbone Model constructor functions, one for each type in the schemas.
 *
 * The models constructed by these functions are very similar to ordinary Backbone Models, but also have a number of
 * significant differences. These differences include *incompatible* changes to the behavior of some Backbone Model
 * functions, as well as the addition of new ones.
 *
 * EVENTS
 * ready:        If you want to know if a model is ready to be used (has an initial set of data retrieved from the
 *               server), then make use of the 'ready' event, which is unique to DSB models. Ready indicates that the
 *               model has retrieved an initial set of data from the server. Unlike ordinary events, if a ready handler
 *               is assigned to a model that is already ready, that handler (and no others) will be triggered
 *               immediately. Ready handlers are  always passed the model as the first, and only, argument. The handler
 *               should have the signature (model)
 * badReference: This is triggered when a model is fetched, and a 404 is returned. The handler should have the signature
 *               (model, errorResult)
 * error:        This is reported when an error is returned from a fetch. Like ready, it will be also immediately
 *               trigger if the object is in a error state. Unlike ready, a model may go into and out of being in
 *               an error state, depending on the results of the last time it was fetched. The handler should have the
 *               signature (model, errorResult)
 * Note: The order of the triggering of badReference, error and the calling of the error handler passed to fetch are not
 * guaranteed.
 *
 * Standard Backbone properties (none of these should be changed)
 *     id              : -- : Standard
 *     idAttribute     : -- : Set to 'reference', as this is the unique ID property name for Delphix Schemas.
 *     cid             : -- : Standard
 *     attributes      : -- : Standard, but essentially private.
 *     changed         : -- : Standard, but essentially private. Use hasChanged() etc.
 *     defaults        : -- : This is not used by DSB Models
 *     validationError : -- : At this time not used.
 *     urlRoot
 *
 * Standard Backbone functions
 *     Unless otherwise noted, all functions accept only attribute names specified in the Delphix schema (they will
 *     throw an error if given something else). If an attribute is of type string/objectReference, then '$attribute' can
 *     be used to retrieve the referenced model. In the descriptions below, functions marked as S can be called on
 *     server models, while those marked as C can be called on client models.
 *
 *     get      : SC : Standard, as above.
 *     set      :  C : Standard, but accepts values for embedded models. Does not accept '$attribute' names.
 *     escape   : SC : Standard, as above. Note that Backbone's escape doesn't deal well with objects or arrays.
 *     has      : SC : Standard, as above.
 *     unset    :  C : Standard, as above. Sets attribute to default value. Embedded models clear()'ed.
 *     clear    :  C : Standard, as above. Sets attributes to default value. Embedded models clear()'ed.
 *     toJSON   : SC : Standard, as above. Recursively includes embedded models.
 *     sync     : -- : Do not use this.
 *     fetch    : -- : Do not use this. Use newClientModel() or getServerModel() instead.
 *     save     : -- : Do not use this. Use $$update() instead.
 *     destroy  : -- : Do not use this. Use $$delete() instead.
 *     keys     : SC : Standard. Does not return the '$attribute' keys.
 *     values   : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     pairs    : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     invert   : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     pick     : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     omit     : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     validate : -- : Do not use this. DSB Models do their own validation. Setting this may have bad effects.
 *     isValid  : -- : Do not use this. DSB Models always valid.
 *     url      : -- : Internal. Returns URL value used by some ajax routines
 *     parse    : -- : Internal. Processes values returned from the server.
 *     clone    : SC : Returns a Client Model which is a deep-copy of this model.
 *     isNew    : SC : Standard. (but pretty useless)
 *     hasChanged         : SC : Standard. Does not reflect $attribute names.
 *     changedAttributes  : SC : Standard. Does not reflect $attribute names.
 *     previous           : SC : Standard. Does not reflect $attribute names.
 *     previousAttributes : SC : Standard. Does not reflect $attribute names.
 *
 * DSB Model functions
 *     instanceOf    : SC : Returns whether the model is an instance of another type.
 *     isServerModel : SC : Returns true if this is a server model
 *     $$update      : S  : Updates the version of the model on the server
 *     $$delete      : S  : Deletes the server object
 *     $operation    : SC : Calls the relevant operation. Model must have a reference value to use these.
 *
 * Private to dxCore Data
 *     context._assertParametersGood    : Validate that a set of parameters are valid.
 *     context._newClientModel          : Makes a client model
 *     context._newServerModel          : Makes a server model
 *     context._getRootType             : Returns the most distant super type that has the same root property.
 *     context._convertXhrToErrorResult : Converts an xhr into an ErrorResult object.
 *
 * ROOT OPERATIONS
 * All root operations on schemas, and all create operations are stored in
 *     context.rootOps.Type.$rootOperation
 *     context.rootOps.Type.$$create
 *
 * Note: This does not alter the basic Backbone library in any way. This means this can co-exist with ordinary
 *     Backbone usage, or even other Backbone-based libraries (if they don't modify Backbone, of course).
 *
 * Parameters:
 *     schemas: The set of schemas this should generate constructors from.
 *     context: The object to put the resulting constructors (_modelConstructors) on. If not specified, puts them on
 *              'this'.
 */
dx.core.data._generateModelConstructors = function(schemas, context) {

    // Note: 'context' is the only true 'global' within this closure. Please don't add others.

    /*
     * ========================================
     * Model functions.
     * ========================================
     */

    /*
     * Backbone defines this as: Bind a callback function to an object. The callback will be invoked whenever the event
     * is fired.
     *
     * For DSB models, we provide standard behavior for this, but do some special processing if someone is listening
     * for the 'ready' or 'error' event. In that case, if we have already fetched the model (or if this is a client
     * model), then trigger the ready event immediately.  Note that if the model is already ready or in error,
     * then we will react to 'ready' or 'error' immediately without storing the listener, since this is a one
     * time pseudo-event.
     */
    function dxOn(name, callback, context) {
        var transientTrigger;

        /*
         * If the user is asking for ready, and we are already ready or in error, then trigger the ready or
         * do nothing. There is no reason to keep the event listener around for more than this call.
         * Similarly if the user is asking for the error pseudo event.
         */
        if (name === 'ready') {
            if (this._dxIsReady) {
                transientTrigger = triggerReady;
            } else if (this._dxErrorResult) {
                return;
            }
        } else if (name === 'error') {
            if (this._dxErrorResult) {
                transientTrigger = triggerError;
            } else if (this._dxIsReady) {
                return;
            }
        }

        if (transientTrigger) {
            var tempContext = {};
            Backbone.Events.on.call(this, name, callback, tempContext);
            transientTrigger(this);
            Backbone.Events.off.call(this, name, callback, tempContext);
        } else {
            Backbone.Events.on.call(this, name, callback, context);
        }
    }

    /*
     * Either 'ready' or 'error' events is triggered once in the lifecycle of a model. Cleanup listeners as soon as
     * possible.
     *
     * Without this automatic cleanup, callers would have to setup 2 listeners and cancel each other when triggered.
     * Note that we look at the list of events before triggering events so as to allow event handlers to attach new
     * handlers.
     */
    function removeEventHandlers(model, events) {
        _.each(events, function(value, name) {
            _.each(value, function(event) {
                if (event.callback) {
                    model.off(name, event.callback);
                }
            });
        });
    }

    /*
     * Get a copy of the current event handlers.
     */
    function getEventHandlers(model) {
        if (!model._events) {
            return {};
        }
        return {
            error: (model._events.error || []).slice(0),
            ready: (model._events.ready || []).slice(0)
        };
    }

    /*
     * Trigger the 'ready' event and clean up error listeners
     */
    function triggerReady(model) {
        var handlers = getEventHandlers(model);
        model.trigger('ready', model);
        removeEventHandlers(model, handlers);
    }

    /*
     * Trigger the 'error' event and clean up ready listeners
     */
    function triggerError(model) {
        var handlers = getEventHandlers(model);
        model.trigger('error', model, model._dxErrorResult);
        removeEventHandlers(model, handlers);
    }

    /*
     * Backbone defines this as: Get the current value of an attribute from the model.
     *
     * For DSB models, this does the same thing, with two additional features. First, asking for an attribute that isn't
     * in the schema definition will cause an error to be thrown.  Second, if there is an attribute named 'attr' whose
     * schema property is of type string/objectReference, then one can also get('$attr'), and this will return the
     * corresponding DSB model.
     */
    function dxGet(attrName) {
        var info = assertAndGetAttrInfo(this, attrName);

        if (isObjectRefProp(info.propDef) && info.wantsModel) {
            var referenceValue = this.attributes[info.baseName];
            if (dx.core.util.isNone(referenceValue)) {
                return;
            }
            if (_.isString(referenceValue)) {
                return context._cache.getCachedModel(referenceValue, getRootType(info.propDef.referenceTo));
            }
            dx.fail('Tried to retrieve a related object with ' + attrName + ' but value was ' + referenceValue + '.');
        } else {
            return Backbone.Model.prototype.get.call(this, info.baseName);
        }
    }

    /*
     * Backbone defines this as: Set a hash of attributes (one or many) on the model. If any of the attributes change
     * the model's state, a 'change' event will be triggered on the model.
     *
     * For DSB Models, there are a number of differences.
     *     1) Only attributes defined in the schemas can be set.
     *     2) Attributes may only be set to values with the data type specified in the schemas.
     *     3) DSB models may contain 'embedded' DSB models (object/$ref)
     *
     * To set an attribute on an embedded DSB model, one must still specify values in JSON format. Thus:
     *     myModel.set({
     *         attr: 1,
     *         myEmbeddedModel: {
     *             embeddedAttr: 34
     *         }
     *     })
     * Note that it is legal, in some circumstances, to change the type of an embedded model with a set. Naturally,
     * on a ServerModel, only the server may do this, however on a ClientModel this can happen quite freely. The
     * important things to keep in mind are the following:
     *     a) When the type changes, the new type must be compatible with the type declared in the schema (which is to
     *        say you may change it to that type or any subtype, but may not change it to an unrelated type).
     *     b) Changing a type is equivalent to setting that embedded model to a new instance. That is, any values that
     *        were in the embedded model before the set are replaced with default values, and then the values specified
     *        to this set() routine are applied.
     *     c) However, listeners on this embedded model are not affected, and appropriate change notifications will be
     *        sent on setting.
     *
     * A DSB model may, legitimately, have an array or object that, itself, contains a DSB model (for example, an
     * APIError may contain a plain JSON object whose values are other APIErrors).  To deal with this properly, set()
     * will detect any object that has a 'type' property, whose value is a Delphix-schema type name, and create a
     * DSB model automatically. Without that type property, however, set() will treat the object as an ordinary
     * JSON object.
     *
     * Arrays in a Delphix schema may or may not have a type specified for items. If they do, set() will enforce that
     * type. If not, then the items in the array passed in will be examined and recursively processesed as appropriate.
     * Similarly, if a plain object is encountered, set() will process its values recursively (including turning them,
     * or their own properties, into DSB models as appropriate)
     *
     * A schema property defined with type=string and format=date gets some special treatment.  In that case, you can
     * pass a string in YYYY-MM-DDTHH:MM:SS.MMMZ format, or a Javascript Date object (the former will be converted to
     * a Date object internally, so immediately calling get() will not return the original string).
     */
    function dxSet(key, value, options) {
        var self = this;
        var newAttrs = {};
        var preConvertAttrs;
        var postConvertAttrs;

        if (_.isUndefined(key)) {
            return self;
        }

        if (_.isObject(key)) {
            newAttrs = key;
            options = value;

            if (newAttrs instanceof Backbone.Model) {
                newAttrs = newAttrs.toJSON();
            }
        } else {
            newAttrs[key] = value;
        }

        options = options || {};

        /*
         * Check whether this set would change the type of the model. This only allows changing to a subtype.
         */
        if (newAttrs.type && newAttrs.type !== self._dxSchema.name) {
            if (firstIsSubtypeOfSecond(newAttrs.type, self._dxSchema.name) || options._allowTypeConversion) {
                preConvertAttrs = _.clone(self.attributes);
                convertToType(self, newAttrs.type);
                postConvertAttrs = _.clone(self.attributes);
            } else {
                dx.fail('Tried to change this from ' + self._dxSchema.name + ' to ' + newAttrs.type + '.');
            }
        }

        /*
         * Reject the set if any of the attributes aren't of the right type
         */
        var invalidAttrs = _.omit(newAttrs, _.keys(self._dxSchema.properties || {}));
        if (!_.isEmpty(invalidAttrs)) {
            dx.fail(_.keys(invalidAttrs) + ' are not attributes of a model of type ' + self._dxSchema.name + '.');
        }

        /*
         * Validate types match, and prepare values to be set
         */
        var finalAttrs = {};
        var subModelsToSet = {};
        var subModelsToClear = [];
        var subModelsToConvert = {};

        _.each(newAttrs, function(newValue, newName) {
            var propDef = self._dxSchema.properties[newName];
            var newType = assertValueMatchesDefinition(newName, newValue, propDef);

            switch (newType) {
                case 'undefined':
                case 'boolean':
                case 'string':
                case 'number':
                case 'integer':
                    finalAttrs[newName] = newValue;
                    break;
                case 'null':
                    var nullable = _.any(propDef.type, function(type) {
                        return type === 'null';
                    });
                    if (self.get(newName) instanceof Backbone.Model && !nullable) {
                        subModelsToClear.push(newName);
                    } else {
                        finalAttrs[newName] = undefined;
                    }
                    break;
                case 'date':
                    if (newValue instanceof Date) {
                        finalAttrs[newName] = new Date(newValue.getTime());
                    } else {
                        finalAttrs[newName] = new Date(newValue);
                    }
                    break;
                case 'array':
                    finalAttrs[newName] = setupArray(newValue, propDef.items);
                    break;
                case 'object':
                    if (self.get(newName) instanceof Backbone.Model) {
                        if (newValue.type && self.get(newName).get('type') !== newValue.type) {
                            subModelsToConvert[newName] = newValue;
                        } else {
                            subModelsToSet[newName] = newValue;
                        }
                    } else {
                        finalAttrs[newName] = setupObject(newValue);
                    }
                    break;
            }
        });

        /*
         * Finally, set all the values
         */
        _.each(subModelsToClear, function(attrName) {
            self.get(attrName)._dxClear(options);
        });

        var revisedOptions = _.extend(_.clone(options), { _allowTypeConversion: true });
        _.each(subModelsToConvert, function(value, key) {
            var subModel = self.get(key);
            subModel._dxSet(value, revisedOptions);
        });

        _.each(subModelsToSet, function(value, key) {
            self.get(key)._dxSet(value, options);
        });

        /*
         * If we did a type converstion, we need to make sure to send all the change:AttrName events before we send
         * the final change event.  Because we're relying on the Backbone set routine, it may think it needs to send
         * the change event when it is done, but we have the potential to send a variety of other events afterwards.
         * To work around this, we store all calls to trigger() until we are done.
         */
        if (preConvertAttrs) {
            interceptTrigger(self);
        }

        /*
         * This will set all the values, and trigger change:attr events for all the attributes that changed
         * Note that if this is doing a type conversion, this will trigger changes for:
         *   - attributes that were added (though conversion) and then changed
         *   - attributes that existed before and after conversion, and changed from their converted value
         */
        var result = Backbone.Model.prototype.set.call(self, finalAttrs, options);

        if (preConvertAttrs) {
            var removedAttrs = _.omit(preConvertAttrs, _.keys(postConvertAttrs));
            var addedAttrs = _.omit(postConvertAttrs, _.keys(preConvertAttrs));
            var continuedAttrs = _.pick(preConvertAttrs, _.keys(postConvertAttrs));

            // trigger change events for the attributes were removed
            _.each(removedAttrs, function(value, key) {
                self.trigger('change:' + key, self, undefined);
            });

            // trigger change events for the attributes that were added, by conversion, but not changed
            _.each(addedAttrs, function(value, key) {
                if (addedAttrs[key] === self.attributes[key]) {
                    self.trigger('change:' + key, self, self.attributes[key]);
                }
            });

            _.each(continuedAttrs, function(value, key) {
                /*
                 * Suppress a change:attrName event if if the attr changed during the set() to the same value as before
                 * the conversion suppress event/
                 */
                if (continuedAttrs[key] === self.attributes[key] && postConvertAttrs[key] !== self.attributes[key]) {
                    self._suppressEvents.push('change:' + key);
                }
                /*
                 * Trigger a change:attrName if the value changed during conversation, but then wasn't changed by set.
                 * For example: The original value was 1, then when we changed the type we put the default value of 2
                 * in, and then Backbone's set changed it to 2.  So, set() didn't send an event, but we know that
                 * there actually was a change from the client's point of view.
                 */
                if (continuedAttrs[key] !== postConvertAttrs[key] && postConvertAttrs[key] === self.attributes[key]) {
                    self.trigger('change:' + key, self, self.attributes[key]);
                }
            });

            replayTriggers(self);
        }

        return result;
    }

    /*
     * Intercept and queue for later restoration, all calls to trigger().
     * This also sets up a temporary property on the model, _suppressEvents, which is a list of events to not
     * send when replayTriggers is called.
     */
    function interceptTrigger(model) {
        model._queuedEvents = [];
        model._storedTriggerFunction = model.trigger;
        model._suppressEvents = [];
        model.trigger = function() {
            model._queuedEvents.push(arguments);
        };
    }

    /*
     * Send all paused events on their way, with some modifications including: suppressing certain named events, and
     * assuring a change event is sent after all change:attrName events (but not if there are none)
     */
    function replayTriggers(model) {
        var changeEvent;
        var seenAttrChange = false;
        model.trigger = model._storedTriggerFunction;
        delete model._storedTriggerFunction;

        _.each(model._queuedEvents, function(args) {
            // don't send the change event yet
            if (args[0] === 'change') {
                changeEvent = args;
                return;
            }

            // don't send events we are to suppress
            if (_.contains(model._suppressEvents, args[0])) {
                return;
            }

            if (args[0].indexOf('change:') === 0) {
                seenAttrChange = true;
            }
            model.trigger.apply(model, args);
        });
        delete model._queuedEvents;
        delete model._suppressEvents;

        if (changeEvent) {
            model.trigger(changeEvent);
        } else if (seenAttrChange) {
            model.trigger('change', model);
        }
    }

    /*
     * Backbone defines this as: Returns true if the attribute is set to a non-null or non-undefined value.
     */
    function dxHas(attrName) {
        if (!_.isString(attrName)) {
            dx.fail('Must provide an attribute name.');
        }

        var info = getAttrInfo(this, attrName);

        // dxGet will throw an exception for unknown attributes, so reach directly into the attributes to avoid this
        return info.baseName && !dx.core.util.isNone(this.attributes[info.baseName]);
    }

    /*
     * Backbone defines this as: Remove an attribute by deleting it from the internal attributes hash. Fires a 'change'
     * event unless silent is passed as an option.
     *
     * For DSB models, the behavior is a bit different:
     *  1) Calling unset() on a defined attribute will cause that to be reset to its default value, unless it is an
     *     embedded object, in which case it is equivalent to calling clear() on it.
     *  2) Calling unset() an attribute that isn't defined in the schemas will throw an error
     *  3) calling unset('$attribute') will unset 'attribute'
     *  4) This considers the default of a 'type' attribute to be the schema name, and so unset will never actually
     *     change it.
     */
    function dxUnset(attrName, options) {
        var info = assertAndGetAttrInfo(this, attrName);

        if (attrName === 'type') {
            return;
        }

        if (isEmbeddedProp(info.propDef)) {
            this.attributes[attrName].clear(options);
        } else {
            this.set(info.baseName, defaultFor(info.propDef, this._dxIsClientModel), options);
        }
    }

    /*
     * Backbone defines this as: Removes all attributes from the model, including the id attribute. Fires a 'change'
     * event unless silent is passed as an option.
     *
     * For DSB models, this resets all attributes to their default values, unless they are embedded objects, in which
     * case clear() is recursively called on them.
     */
    function dxClear(options) {
        var changes = {};
        _.each(this._dxSchema.properties, function(propDef, propName) {
            if (propName === 'type') {
                return;
            }
            if (isEmbeddedProp(propDef)) {
                this.attributes[propName]._dxClear(options);
            } else {
                changes[propName] = defaultFor(propDef, this._dxIsClientModel);
            }
        }, this);

        if (!_.isEmpty(changes)) {
            this._dxSet(changes, options);
        }
    }

    /*
     * Backbone defines this as: Return a copy of the model's attributes for JSON stringification. This can be used for
     * persistence, serialization, or for augmentation before being sent to the server.
     *
     * Our differences are that we will recursively call this on any embedded objects, and we do deep clones of any
     * objects or arrays.
     */
    function dxToJSON() {
        return jsonIze(this);
    }

    /*
     * Wrapper around standard Backbone url().  We do this because we build a common url access scheme that is
     * available to both root operations and object operations.
     */
    function dxUrl() {
        return this.url();
    }

    /*
     * Backbone defines this as: parse() is called whenever a model's data is returned by the server. The function is
     * passed the raw response object, and returns the attributes hash to be set on the model.
     *
     * Delphix values returned from the server come in several flavors:
     *  1) an ErrorResult. This means that whatever request got to us failed.
     *  2) an OKResult. This is the result of a successful call
     *  3) a 'naked' Delphix object type. This happens when a collection is parsing each object in its returned array.
     *  4) a ListResult, or other Delphix return value.  These should never happen here.
     *
     * In the case of problems (cases 1 and 4), we return undefined (we report the error result through the error result
     * handler).  For 2 we extract the object in the result and return that. For 3, assuming the type is one we know,
     * return that unchanged.  If it is an unknown type, however, we log an error and return undefined. An undefined
     * return value indicates that there is no data to be parsed out of the response.
     */
    function dxParse(response) {
        if (!response || !response.type) {
            dx.warn('Got an undefined response, or one without a type in parse().');
            return;
        }

        if (response.type === 'OKResult') {
            return response.result;
        } else if (isSchemaType(response.type)) {
            return response;
        } else {
            dx.warn('Got an unexpected type of response (' + response.type + ') in parse().');
            return;
        }
    }

    /*
     * Backbone defines this as: Returns a new instance of the model with identical attributes.
     *
     * For DSB models, this returns a client model that is a deep copy of the model. All embedded models are also
     * made as client models.
     */
    function dxClone() {
        var newModel = newClientModel(this._dxSchema.name);

        newModel.set(this.toJSON());
        newModel.changed = {};  // Shhh. we didn't actually change anything!

        return newModel;
    }

    /*
     * Returns true if the provided type name is this object's type name, or the type name of one of this model's
     * extended types.  Will throw an exception if the provided type name isn't one of the schema types.
     */
    function instanceOf(typeName) {
        if (!_.isString(typeName)) {
            dx.fail('instanceOf() requires a type name as a parameter.');
        }

        if (!isSchemaType(typeName)) {
            dx.fail(typeName + ' is not a known type name.');
        }

        var candidateTypeInfo = this._dxSchema;

        while (candidateTypeInfo) {
            if (candidateTypeInfo.name === typeName) {
                return true;
            }

            candidateTypeInfo = candidateTypeInfo.parentSchema;
        }

        return false;
    }

    function isServerModel() {
        return !this._dxIsClientModel;
    }

    /*
     * Entirely block the standard Backbone destroy() routine. We want users to call $$delete() instead.
     */
    function noDestroy() {
        dx.fail('Do not call destroy() directly. Instead, call $$delete().');
    }

    /*
     * Delete this model on the server.  On success, this will clear() this model.  This will also fire
     * a 'request' event on the model before making the call, and a 'sync' and 'destroy' afterwards on success.
     * Depending on the underlying schema definition, this can be called in any of these ways:
     *    $$delete([successError])  // in case of no payload defined
     *    $$delete(payload[, successError])  // in case of payload required
     *    $$delete([payload][, successError])  // in case of payload optional
     */
    function dxDelete(arg1, arg2) {
        var opDef = this._dxSchema.delete;

        if ((arg1 instanceof Backbone.Model) && !opDef.payload) {
            dx.fail('$$delete does not allow a payload.');
        }

        var payload = arg1;
        var successError = arg2;
        if (!opDef.payload ||
            !opDef.required && !(arg1 instanceof Backbone.Model)) {
            payload = undefined;
            successError = arg1;
        }

        assertHasReferenceAttr(this, '$delete', true);
        var preparedData = assertAndPreparePayload('$delete', opDef, payload);

        return callOperation(this, {
            data: preparedData,
            url: this.url()
        }, 'DELETE', opDef, successError);
    }

    /*
     * Create a new object on the server. It is normally called like this:
     *    $$create(payload[, successError])
     * However, it could be called in the following ways should a schema one day not require payload to do create
     *    $$create([successError])  // in case of no payload defined
     *    $$create([payload][, successError])  // in case of payload optional
     */
    function dxCreate(opDef, url, arg1, arg2) {
        if ((arg1 instanceof Backbone.Model) && !opDef.payload) {
            dx.fail('$$create does not allow a payload.');
        }

        var payload = arg1;
        var successError = arg2;
        if (!opDef.payload ||
            !opDef.required && !(arg1 instanceof Backbone.Model)) {
            payload = undefined;
            successError = arg1;
        }

        return callOperation({}, {
            data: assertAndPreparePayload('$create', opDef, payload),
            url: url
        }, 'POST', opDef, successError);
    }

    /*
     * Entirely block the standard Backbone save() routine. We want users to call $$update() instead.
     */
    function noSave() {
        dx.fail('Do not call save() directly. Instead, call $$update().');
    }

    /*
     * Update the version of this model on the server. This sends to the server:
     *  1) Any required or update:required attributes defined for this type
     *  2) Any required:false or update:optional attributes from the set passed in this function
     */
    function dxUpdate(attributes, successError) {
        var opDef = this._dxSchema.update;

        if (dx.core.util.isNone(attributes) || _.isEmpty(attributes)) {
            dx.fail('$$update must be called with a non-empty set of attributes.');
        }
        assertHasReferenceAttr(this, '$update', !this._dxSchema.singleton);

        var newModel = this.clone();
        newModel.set(attributes);

        var preparedData = JSON.stringify(jsonIzeForUpdate(attributes, newModel, this, true));

        return callOperation(this, {
            data: preparedData,
            url: this._dxGetUrl()
        }, 'POST', opDef, successError);
    }

    /*
     * Entirely block the standard Backbone fetc() routine.
     */
    function noFetch() {
        dx.fail('Do not call fetch() directly. Instead, call getServerModel().');
    }

    /*
     * Mark the specified model as 'ready'. The 'triggerNotify' parameter controls whether we trigger the 'ready'
     * event. This is exposed to the level3 API so that a collection can be marked as ready before notifying consumers.
     */
    function makeReady(model, triggerNotify) {
        model._dxIsReady = true;

        _.each(model._dxSchema.properties, function(propDef, propName) {
            if (isEmbeddedProp(propDef) && model.get(propName)) {
                makeReady(model.get(propName), triggerNotify);
            }
        });

        if (triggerNotify) {
            triggerReady(model);
        }
    }

    /*
     * Handle an error for a successError callback or an array of callbacks.
     * The context error handler is invoked once unless all callbacks define a custom error handler.
     */
    function handleErrorResult(processedResult, successError) {
        var callbacks = _.isArray(successError) ? successError : [successError];
        var reportedError = false;
        _.each(callbacks, function(successError) {
            if (successError && successError.error) {
                successError.error(processedResult);
            } else if (!reportedError && (!successError || !successError.suppressDefaultErrorHandler)) {
                context.reportErrorResult(processedResult);
                reportedError = true;
            }
        });
    }

    /*
     * This is a slightly modified copy of the fetch function from knockback's version of Backbone. This is modified
     * in that it calls our own private version of set and directly calls Backbone.sync (which is all that knockback's
     * Backbone does at the moment).
     */
    function dxFetch(successError) {
        var model = this;
        model._dxFetchQueue = model._dxFetchQueue || [];
        model._dxFetchQueue.push(successError);
        if (model._dxFetchQueue.length === 1) {
            dxFetchNow(model);
        }
    }

    function dxFetchNow(model) {

        /*
         * Applies the handler to the pending request queue.
         *
         * If there is more than one callback in the queue, apply the response to entries 0..N-2 and issue a new
         * dxFetch for the most recent request.
         *
         * If dxFetch requests are issued during callback execution, they do not resolve immediately.
         */
        function makeHandler(mainHandler) {
            return function dxFetchCallbackHandler(arg) {
                var queue = model._dxFetchQueue;
                delete model._dxFetchQueue;
                var callbacks = _.first(queue, Math.max(1, queue.length - 1));
                mainHandler(arg, callbacks);
                if (queue.length > 1) {
                    model._dxFetch(_.last(queue));
                }
            };
        }

        var options = {
            parse: true,
            success: makeHandler(function(resp, callbacks) {
                if (resp && resp.type === 'ErrorResult') {
                    var processedResult = resultToModel(resp);
                    model._dxErrorResult = processedResult;
                    triggerError(model);
                    return handleErrorResult(processedResult, callbacks);
                }

                model._dxErrorResult = undefined;
                model._dxSet(model.parse(resp), options);

                makeReady(model, true);

                _.each(callbacks, function(successError) {
                    if (successError && successError.success) {
                        successError.success(model);
                    }
                });

            }),
            error: makeHandler(function(xhr, callbacks) {
                var errorResult = convertXhrToErrorResult(xhr);
                handleErrorResult(errorResult, callbacks);
                if (xhr && xhr.status === 404) {
                    model.trigger('badReference', model, errorResult);
                }
                model._dxErrorResult = errorResult;
                triggerError(model);
            })
        };

        Backbone.sync('read', model, options);
    }

    /*
     * ========================================
     * Operations: creation and handling
     * ========================================
     */

    /*
     * Examine the operations provided, and add them to the target object.
     *
     * target:     The object to add the constructed functions to
     * operations: A JSON object with keys as the operation names, and  values as definitions of that operation.
     * namePrefix  A string to prefix to the name of the operation when adding to the target
     * urlPrefix:  A string to prefix to the constructed url for the operation
     * perObject:  Whether these operations are ones that require the object's reference.
     */
    function addOperations(target, operations, namePrefix, urlPrefix, perObject) {
        _.each(operations, function(opDef, opName) {
            var opFunction;
            var opUrl = (urlPrefix === '') ? opName : urlPrefix + '/' + opName;

            if (!_.isUndefined(opDef.payload)) {
                opFunction = (_.isEmpty(opDef.payload)) ?
                    function(successError) {
                        return noPayloadFunction(this, opUrl, opDef, perObject, successError);
                    } :
                    function(payload, successFailure) {
                        return payloadFunction(this, opUrl, opDef, perObject, payload, successFailure);
                    };
            } else {
                opFunction = (_.isEmpty(opDef.parameters)) ?
                    function(successError) {
                        return noParametersFunction(this, opUrl, opDef, perObject, successError);
                    } :
                    function(parameters, successFailure) {
                        return parametersFunction(this, opUrl, opDef, perObject, parameters, successFailure);
                    };
            }

            if (_.has(opDef, 'dxOperations')) {
                addOperations(target, opDef.dxOperations, namePrefix + opName + '_', opUrl, perObject);
            }

            target['$' + namePrefix + opName] = opFunction;
        });
    }

    /*
     * Call a server function that has no payload.
     */
    function noPayloadFunction(caller, opName, opDef, perObject, successError) {
        assertHasReferenceAttr(caller, opName, perObject);

        if (successError instanceof Backbone.Model) {
            dx.fail('$' + opName + ' can not be called with a payload (only a success/error object).');
        }

        return callOperation(caller, {
                url: caller._dxGetUrl() + '/' + opName
            }, 'POST', opDef, successError);
    }

    /*
     * Call a server function that has a payload (which is always a single DSB model).
     */
    function payloadFunction(caller, opName, opDef, perObject, payload, successError) {
        assertHasReferenceAttr(caller, opName, perObject);

        return callOperation(caller, {
                data: assertAndPreparePayload(opName, opDef, payload),
                url: caller._dxGetUrl() + '/' + opName
            }, 'POST', opDef, successError);
    }

    /*
     * Call a server function that is a 'GET', and takes no parameters.
     */
    function noParametersFunction(caller, opName, opDef, perObject, successError) {
        assertHasReferenceAttr(caller, opName, perObject);

        return callOperation(caller, {
                url: caller._dxGetUrl() + '/' + opName
            }, 'GET', opDef, successError);
    }

    /*
     * Call a server function that expects one or more parameters.
     */
    function parametersFunction(caller, opName, opDef, perObject, parameters, successError) {
        var sendableParams;
        assertHasReferenceAttr(caller, opName, perObject);

        if (!_.isObject(parameters) && !dx.core.util.isNone(parameters)) {
            dx.fail('$' + opName + ' must be passed a (possibly empty) hash of parameters.');
        }

        if (!dx.core.util.isNone(parameters)) {
            sendableParams = checkAndConvertParameters(parameters, opDef.parameters);
        }

        return callOperation(caller, {
                data: sendableParams,
                url: caller._dxGetUrl() + '/' + opName
            }, 'GET', opDef, successError);
    }

    function assertHasReferenceAttr(model, opName, perObject) {
        if (!model.id && perObject) {
            dx.fail('$' + opName + ' can not be called without a reference property set.');
        }
    }

    /*
     * Invoke whatever operation was set up, above, and then handle the return values.
     * Handling a return value means:
     *  1) If a success handler was provided, and OKResult (or subtype) was returned, pass that to the handler.
     *  2) IF an error handler was provided, and an ErrorResult was returned, pass the ErrorResult to the handler.
     *     Otherwise pass it on to the standard application-wide error handler, unless suppressErrorHandler was
     *     specified.
     *  3) IF some other error occurred, wrap the HTTP failure information into a new ErrorResult and either pass
     *     onto the provided handler or the system-wide hander, unless suppressErrorHandler was specified.
     */
    function callOperation(caller, options, type, opDef, successError) {
        if (successError && _.has(successError, 'success') && !_.isFunction(successError.success)) {
            dx.fail('The success handler must be a function, but found a ' + typeof successError.success + '.');
        }

        if (successError && _.has(successError, 'error') && !_.isFunction(successError.error)) {
            dx.fail('The error handler must be a function, but found a ' + typeof successError.error + '.');
        }

        var deferred = new $.Deferred();

        var params = {
            success: function(result) {
                var processedResult;
                if (result && result.type === 'ErrorResult') {
                    processedResult = resultToModel(result);
                    handleErrorResult(processedResult, successError);
                    deferred.reject(processedResult);
                } else {
                    if (dx.core.util.isNone(result) || dx.core.util.isNone(result.type)) {
                        dx.fail('Operation returned success, but without a typed object: ' + result);
                    }
                    if (dx.core.util.isNone(opDef.return) && result.result === '') {
                        delete result.result;
                    }
                    assertValueMatchesDefinition('(return value)', result.result, opDef.return);
                    processedResult = resultToModel(result);
                    if (successError && successError.success) {
                        successError.success(processedResult);
                    }
                    if (successError && successError.jsonSuccess) {
                        successError.jsonSuccess(result);
                    }
                    if (_.isFunction(caller.trigger)) {
                        caller.trigger('sync', caller);
                    }
                    deferred.resolve(processedResult);
                }
            },
            error: function(xhr) {
                var errorResult = convertXhrToErrorResult(xhr);
                handleErrorResult(errorResult, successError);
                deferred.reject(errorResult);
            }
        };

        if (_.isFunction(caller.trigger)) {
            caller.trigger('request', caller);
        }

        _.extend(params, options);

        params.type = type;

        dx.core.ajax.ajaxCall(params);
        return deferred.promise();
    }

    /*
     * Validate that the payload matches the definition for the operation.
     */
    function assertAndPreparePayload(opName, opDef, payload) {
        if (dx.core.util.isNone(payload) && opDef.payload && opDef.payload.required) {
            dx.fail('Must call $' + opName + ' with a payload of type ' + opDef.payload.$ref + '.');
        }

        if (!dx.core.util.isNone(payload)) {
            if (!_.isObject(payload) || !(payload instanceof Backbone.Model)) {
                dx.fail('Must call $' + opName + ' with a backbone model.');
            }

            if (!payload.instanceOf(opDef.payload.$ref)) {
                dx.fail('Must call $' + opName + ' with an instance of ' + opDef.payload.$ref + '.');
            }

            return JSON.stringify(jsonIze(payload, opDef.validateAs || 'send'));
        }
    }

    /*
     * Given a parameters object (an ordinary JSON object), compare these with the parameter definitions from the
     * schemas.  If there are any type mismatches, parameters that are not supported, or required parameters that are
     * missing, throw an error.
     *
     * Return a copy of the parameters that are suitable for passing to an AJAX call (Date object converted to
     * the server date string format)
     */
    function checkAndConvertParameters(parameters, paramDefinitions) {
        parameters = parameters || {};
        var undefinedParams = _.omit(parameters, _.keys(paramDefinitions));
        if (!_.isEmpty(undefinedParams)) {
            dx.fail(_.keys(undefinedParams).join(', ') + ' is not a valid parameter name.');
        }

        _.each(parameters, function(value, key) {
            if (_.isUndefined(value)) {
                dx.fail('Can not send a request with an undefined parameter (' + key + ' is undefined).');
            }
        });

        _.each(paramDefinitions, function(paramDef, paramName) {
            if (_.has(parameters, paramName)) {
                assertValueMatchesDefinition(paramName, parameters[paramName], paramDef);
            } else if (paramDef.required) {
                dx.fail(paramName + ' is required, but has not been passed.');
            }
        });

        // slightly misuse the jsonIze() routine. It does what we need, even if parameters isn't a Backbone model.
        return jsonIze(parameters, 'send');
    }

    /*
     * ========================================
     * Model creation functions
     * ========================================
     */

    /*
     * Returns a new DSB model which is set to be a server model.
     */
    function newServerModel(typeName) {
        var model = makeNewModel(typeName, false);

        makeIntoServerModel(model);

        return model;
    }

    /*
     * Returns a new DSB model which is set to be a client model.
     */
    function newClientModel(typeName) {
        var model = makeNewModel(typeName, true);
        makeReady(model, true);
        return model;
    }

    /*
     * Convert a JSON result object into a client model.
     */
    function resultToModel(result) {
        var model = newClientModel(result.type);
        model.set(result);
        return model;
    }

    /*
     * Create a new model instance. Aside from creating the model, we manually populate the default set of attributes,
     * since the Backbone system doesn't really understand embedded models.
     */
    function makeNewModel(typeName, isClient) {
        if (dx.core.util.isNone(typeName)) {
            dx.fail('To create a new model, a type name must be provided.');
        }

        if (!isSchemaType(typeName)) {
            dx.fail(typeName + ' is not a known type name. Can not create one.');
        } else {
            var model = new context._modelConstructors[typeName]();
            model._dxIsClientModel = isClient;
            buildDefaultAttributes(model, model._dxSchema.properties || {});
            return model;
        }
    }

    /*
     * Fill in the defaults for all attributes on the specified model.  This directly manipulates the attributes
     * property, thus bypassing the normal set() semantics.  This is actually OK, as the default Backbone behavior is
     * not to change its changedAttributes() values (etc) at creation time. Additionally, we don't want to be triggering
     * events when doing this.
     */
    function buildDefaultAttributes(model, propDefs) {
        _.each(propDefs, function(propDef, propName) {
            model.attributes[propName] = defaultFor(propDef, model._dxIsClientModel);
        });

        if (!_.isUndefined(propDefs.type)) {
            model.attributes.type = model._dxSchema.name;
        }
    }

    /*
     * Given a type definition, return the default value for that type.
     */
    function defaultFor(propDef, isClientModel) {
        var defaultValue = propDef.default;

        // Expose "null" from the server as "undefined" to our clients
        if (propDef.default === null) {
            defaultValue = undefined;
        }

        if (_.isUndefined(defaultValue) &&
            propDef.type === 'object') {
            defaultValue = (_.has(propDef, '$ref')) ?
                isClientModel ? newClientModel(propDef.$ref) : newServerModel(propDef.$ref) :
                undefined;
        }

        return defaultValue;
    }

    /*
     * Changes the specified model (and its embedded models) into a server model.
     */
    function makeIntoServerModel(model) {
        model._dxIsClientModel = false;

        if (model._dxSchema.delete) {
            model.$$delete = model._dxStandardOps.$$delete;
        }

        if (model._dxSchema.update) {
            model.$$update = model._dxStandardOps.$$update;
        }

        model.set = cantModifyServerModel;
        model.clear = cantModifyServerModel;
        model.unset = cantModifyServerModel;
        model.sync = cantModifyServerModel;

        _.each(model._dxSchema.properties, function(propDef, propName) {
            if (isEmbeddedProp(propDef)) {
                makeIntoServerModel(model.get(propName));
            }
        });
    }

    function cantModifyServerModel() {
        dx.fail('Can not modify a server ' + this._dxSchema.name + ' instance.');
    }

    /*
     * Given a type, locate the root parent type (which will be, when walking up the inheritance chain, the last type
     * that has the same value in its root property)
     */
    function getRootType(childType) {
        if (!_.isString(childType)) {
            dx.fail('Must call with a type name.');
        }

        if (!isSchemaType(childType)) {
            dx.fail(childType + ' is not a known type name.');
        }

        return context._modelConstructors[childType].prototype._dxSchema.rootTypeName;
    }

    /*
     * Given xn XmlHttpRequest (or the equivalent), either extract the ErrorResult object from within it and return
     * that, or manufacture an ErrorResult object which contains the HTTP failure information and return that.
     */
    function convertXhrToErrorResult(xhr) {
        var responseInfo = xhr.responseText;

        // for testing xhr may not have getResponseHeader, and not all responses have a content-type!
        var contentType = dx.core.util.isNone(xhr.getResponseHeader) ? undefined :
            xhr.getResponseHeader('content-type');

        if (!dx.core.util.isNone(contentType) &&
            contentType.indexOf('application/json') > -1 &&
            !_.isObject(responseInfo)) {
            try {
                responseInfo = JSON.parse(responseInfo);
            } catch (e) {
                dx.fail('Server response claimed to be application/json, but couldn\'t be parsed as JSON (' +
                    xhr.responseText + ').');
            }
        }

        if (responseInfo && responseInfo.type === 'ErrorResult') {
            return resultToModel(responseInfo);
        } else {
            var errorResult = newClientModel('ErrorResult');
            errorResult.get('error').set({
                details: 'Communication Error',
                commandOutput: 'HTTP Error: ' + xhr.status + '\n' +
                     'Status text: ' + xhr.statusText + '\n' +
                     'Response text: ' + xhr.responseText
            });
            return errorResult;
        }
    }

    /*
     * ========================================
     * 'subroutines' and utility functions
     * ========================================
     */

    /*
     * Validates that the attribute name is a valid attribute name for the model. If so, this returns information about
     * the attribute (see getAttrInfo).
     */
    function assertAndGetAttrInfo(model, attrName) {
        var info = getAttrInfo(model, attrName);

        if (_.isUndefined(info.propDef)) {
            dx.fail(attrName + ' is not a known attribute.');
        }

        return info;
    }

    /*
     * This returns information about the attribute, including its base name (if the value passed was $attr, this
     * returns 'attr'), whether this was a $-prefixed name (and thus it is actually asking for the referenced model),
     * and the definition of the schema property.
     */
    function getAttrInfo(model, attrName) {
        if (!_.isString(attrName)) {
            dx.fail('Must provide an attribute name.');
        }

        var baseName = attrName;
        var wantsModel = false;
        if (baseName.charAt(0) === '$') {
            baseName = baseName.substring(1);
            wantsModel = true;
        }
        var props = model._dxSchema.properties;
        var propDef = props ? props[baseName] : undefined;

        return {
            baseName: baseName,
            wantsModel: wantsModel,
            propDef: propDef
        };
    }

    var dateStringRegex = /\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ/;

    /*
     * Asserts that the specified value matches (is compatible with) the type specified by the definition.
     */
    function assertValueMatchesDefinition(name, value, def) {
        /*
         * Returns the type of the value.  The return values include Javascript typeof type (undefined, object,
         * boolean, number, string, etc) types, with JSON Schema type refinements (null, array, integer).
         */
        function typeOfValue(value) {
            if (_.isNull(value)) {
                return 'null';
            }

            if (_.isArray(value)) {
                return 'array';
            }

            if (typeof value  === 'number') {
                return (value === Math.floor(value)) ? 'integer' : 'number';
            }

            if (value instanceof Date) {
                return 'date';
            }

            if (typeof value === 'string' && dateStringRegex.exec(value)) {
                return 'date-or-string'; // could be either.
            }

            return typeof value;
        }

        function isTypeCompatible(actualType, objectType, defType, defObjectType, defFormat) {
            if (actualType === 'integer' && defType === 'number') {
                return true;
            } else if (actualType === 'null' || actualType === 'undefined') {
                return true;    // can assign null or undefined to all types
            } else if (actualType === 'date' && defType === 'string' && defFormat === 'date') {
                return true;
            } else if (actualType === 'date-or-string' && defType === 'string') {
                if (defFormat === 'date') {
                    type = 'date';
                } else {
                    type = 'string';
                }
                return true;
            } else if ((defType === 'object') && (actualType === 'object')) {
                if (_.isUndefined(defObjectType) || // definition is typeless
                    (!_.isUndefined(defObjectType) && _.isUndefined(objectType)) || // new value is typeless
                    defObjectType === objectType || // types same
                    firstIsSubtypeOfSecond(objectType, defObjectType)) { // new value is subtype
                    return true;
                } else {
                    return false;
                }
            } else {
                return defType === actualType;
            }
        }

        var type = typeOfValue(value);
        var objectType = (type === 'object') ? value.type : undefined;
        var typeMatches;

        if (_.isUndefined(def)) {
            if (dx.core.util.isNone(value)) {
                return type;
            } else {
                dx.fail(name + ' has a value, but it has no definition.');
            }
        }

        if (_.isArray(def.type)) {
            typeMatches = _.find(def.type, function(defType) {
                return isTypeCompatible(type, objectType, defType, def.$ref, def.format);
            });
        } else {
            typeMatches = isTypeCompatible(type, objectType, def.type, def.$ref, def.format);
        }

        if (!typeMatches) {
            if (!def.$ref) {
                dx.fail(name + ' has to be type ' + ((def.type === 'string' && def.format === 'date') ?
                    'date' : def.type) + ' but is ' + type + ' (' + JSON.stringify(value) + ')');
            } else {
                dx.fail(name + ' has to be type ' + def.type + '/' + def.$ref + ' but is ' + type + '/' + objectType);
            }
        }

        /*
         * Note: def.enum throws an error in IE8.  We're also good with undefined/null from previous checks but those
         * values obviously aren't part of the enum
         */
        if (def.enum && !dx.core.util.isNone(value) && !_.contains(def.enum, value)) {
            dx.fail(name + ' is an enum and has to be one of ' + JSON.stringify(def.enum) + ' but is ' +
                JSON.stringify(value));
        }

        return type;
    }

    /*
     * Change the model to another type.  This is done "in place" since we want to preserve any listeners that may
     * have been attached to this object.
     *
     * This returns true if this removed any attributes (it also triggers a 'change:attrName' event for each)
     */
    function convertToType(model, newType) {
        var SourceConstructor = context._modelConstructors[model.get('type')];
        var TargetConstructor = context._modelConstructors[newType];

        // add metadata from the target type, overriding our own.
        model._dxSchema = TargetConstructor.prototype._dxSchema;
        model.urlRoot = TargetConstructor.prototype._dxSchema.root;

        // replace our attributes
        model.attributes = {};
        buildDefaultAttributes(model, model._dxSchema.properties);

        // Remove any operations we previously may have added to this object.
        _.each(model, function(value, name) {
            if (name.charAt(0) === '$') {
                delete model[name];
            }
        });

        /*
         * This is really sad. Since we can't change the prototype of the object at runtime, we necessarily inherit the
         * operations from its prototype.  But if by chance we are converting to a type that doesn't have those
         * operations, we should not allow someone to call them. Insert a dummy function on the leaf object in the
         * prototype chain to keep anyone from actually calling it.
         */
        _.each(SourceConstructor.prototype, function(value, name) {
            if (name.charAt(0) === '$') {
                model[name] = blockPrototypeOperation;
            }
        });

        // Now actually add the operations to this that it should have based on the type it is being converted to.
        _.each(TargetConstructor.prototype, function(value, name) {
            if (name.charAt(0) === '$') {
                model[name] = value;
            }
        });

        if (model._dxSchema.delete) {
            model.$$delete = dxDelete;
        }

        if (model._dxSchema.update) {
            model.$$update = dxUpdate;
        }
    }

    function blockPrototypeOperation() {
        dx.fail('This operation does not exist on this instance. (it has been converted from a type that had it).');
    }

    function firstIsSubtypeOfSecond(childType, parentType) {
        var candidateInfo = isSchemaType(childType) ?
            context._modelConstructors[childType].prototype._dxSchema :
            undefined;

        while (candidateInfo) {
            if (candidateInfo.name === parentType) {
                return true;
            }

            candidateInfo = candidateInfo.parentSchema;
        }

        return false;
    }

    /*
     * As part of the set() process, we can take a JSON array, and convert it into an array ready to be set on the
     * model. This involves two special processes: If an 'items' property has been specified, enforce the type
     * constraint expressed there, and if an object is found that could be converted into a DSB model, create a new
     * model and add it.
     */
    function setupArray(arrayValue, itemDef) {
        var newArray = [];

        _.each(arrayValue, function(value) {
            if (!_.isUndefined(itemDef)) {
                assertValueMatchesDefinition('(array item)', value, itemDef);
            }

            if (_.isArray(value)) {
                newArray.push(setupArray(value));
            } else if (_.isObject(value)) {
                newArray.push(setupObject(value));
            } else {
                newArray.push(value);
            }
        });

        return newArray;
    }

    /*
     * As part of the set() process, take the provided JSON object data, and either convert it into a DSB model, using
     * the type value in the JSON object, or recursively process all the elements in the object and set those on the
     * object this returns.
     */
    function setupObject(objectValue) {
        var newObj = {};

        if (objectValue instanceof Backbone.Model) {
            objectValue = objectValue.toJSON();
        }

        if (isSchemaType(objectValue.type)) {
            newObj = context._cache.getCachedModelFromProperties(objectValue);
        } else {
            _.each(objectValue, function(value, key) {
                if (_.isArray(value)) {
                    newObj[key] = setupArray(value);
                } else if (_.isObject(value)) {
                    newObj[key] = setupObject(value);
                } else {
                    newObj[key] = value;
                }
            });
        }

        return newObj;
    }

    /*
     * Return a version of this model in JSON format, according to the specified mode. The mode may have several values
     * which cause different versions of the model to be returned:
     *
     * undefined: Return all properties.
     * send: Return all non-null required and optional values.
     * create: Return all non-null create required and optional values, as well as required ones.
     * update: Return all non-null update required and optional values, as well as required ones.
     *
     * send, create and update all throw errors if a required attribute is null or undefined (unless that attribute
     * is of type 'null')
     */
    function jsonIze(value, mode) {
        var result;
        if (value instanceof Backbone.Model) {
            result = {};
            _.each(value._dxSchema.properties, function(propDef, key) {
                var attrValue = value.get(key);

                // ordinary jsonizing returns everything
                if (_.isUndefined(mode)) {
                    result[key] = jsonIze(attrValue, mode);
                    return;
                }

                // Don't include read-only properties when sending a property
                if (isReadOnly(propDef, mode)) {
                    return;
                }

                var required = isRequired(propDef, mode);

                // Don't send null when it won't be accepted
                if (dx.core.util.isNone(attrValue) && !isNullableType(propDef)) {
                    if (required) {
                        dx.fail('The attribute ' + key + ' is required to be non-null/non-undefined.');
                    }
                    return;
                }

                result[key] = jsonIze(attrValue, mode);
            });
        } else if (_.isArray(value)) {
            result = [];
            _.each(value, function(item) {
                result.push(jsonIze(item, mode));
            });
        } else if (_.isObject(value)) {
            if (value instanceof Date) {
                result = value.toJSON();
            } else {
                result = {};
                _.each(value, function(propValue, key) {
                    result[key] = jsonIze(propValue, mode);
                });
            }
        } else {
            result = _.isUndefined(value) ? null : value;
        }

        return result;
    }

    /*
     * Doing a $$update requires some special handling, hence it's own jsonize routine here.  The parameters to this are
     *    updateAttrs:   A raw object/hash of attributes that the user has asked to send as an update
     *                   This is needed because it gives us a direct view of which attributes the caller wants to send.
     *    updateModel:   A model that has been .set() with those attributes. This is needed because it has the forms of
     *                   the attributes that have already been fully processed by the overall model system here.
     *    baseModel:     The model that the update is related to. This is needed in order to retrieve some values that
     *                   must be included in the update but were not explicitly set. It also helps us determine when a
     *                   value doesn't need to be sent because the new value is the same as the old.
     *    propsRequired: Whether the properties generated by this call must be included. Always true at the top level,
     *                   and each recursive call sets it based on the schema definition.
     *
     * The basic algorithm here is:
     *    Go over each property in the schema definition
     *    If there is an update attribute for it, then add that to the hash of properties we will return
     *      (but use the jsonIzed version of that attribute from the updateModel, to get all the benefits of proper
     *      jsonization)
     *    However, there are some caveats:
     *       - If the update specifies a value which is not changed, don't send a duplicate
     *       - If a property is required for update, but isn't included in the attributes, grab it from the
     *         base model
     *       - If the update attributes specified an undefined value, and the property is allowed to be null,
     *         we send a null.
     *       - Embedded models need special handling.  If the embedded model is required, then we simply add it to
     *         the set of properties we are returning. If the embedded model is optional, however, then if there are no
     *         new values in that embedded model (even if there are required properties there) then it is not included
     *         in the update.  This, then, is the reason for the propsRequired parameter and the propCount in the
     *         routine.  We tell each subsequent call whether we want it to return the properties even if there is
     *         nothing new.
     */
    function jsonIzeForUpdate(rawUpdateObj, updateModel, baseModel, propsRequired) {
        var jsonUpdatePayload = {};
        var propCount = 0;
        _.each(updateModel._dxSchema.properties, function(propDef, key) {
            // Don't include read-only properties when sending a property
            if (isReadOnly(propDef, 'update')) {
                return;
            }

            var required = isRequired(propDef, 'update');

            if (isEmbeddedProp(propDef)) {
                var subProps = rawUpdateObj ? rawUpdateObj[key] : undefined;
                var baseEmbedded = baseModel.get(key);
                var updateEmbedded = updateModel.get(key);
                var embJson;
                /*
                 * The update may legitimately be trying to change the type of an embedded object. In this case we can't
                 * keep using the baseModel's embedded model to extract properties from (in particular, there may be
                 * properties in the 'update' data that aren't in the embedded model, so there's nothing to extract).
                 * Further, our definition of changing types in embedded models is that we do not preserve any
                 * properties properties that were there before, even if they could be. In this regard, changing the
                 * type isn't an overlay, but is instead a replace operation. To make this work here we create a new
                 * model to be used as the base model for the recursive call to jsonIzing.
                 */
                if (baseEmbedded.get('type') !== updateEmbedded.get('type')) {
                    // Doing an update that changes the type really means we are just sending the new data
                    embJson = jsonIze(updateEmbedded, 'update');
                } else {
                    embJson = jsonIzeForUpdate(subProps, updateEmbedded, baseEmbedded, required);
                }
                if (!_.isUndefined(embJson)) {
                    jsonUpdatePayload[key] = embJson;
                    propCount++;
                }
            } else {
                var baseAttrJson = jsonIze(baseModel.get(key), 'update');
                var updateAttrJson = jsonIze(updateModel.get(key), 'update');
                var updateValue = updateWithChangedValue(rawUpdateObj, key, baseAttrJson, updateAttrJson);

                if (updateValue) {
                    throwIfBadNull(updateAttrJson, propDef, key);
                    propCount++;
                    jsonUpdatePayload[key] = updateAttrJson;
                }
                if (required && !updateValue) {
                    throwIfBadNull(baseAttrJson, propDef, key);
                    jsonUpdatePayload[key] = baseAttrJson;
                }
            }
        });

        var returnValue = propsRequired || (propCount > 0);

        return returnValue ? jsonUpdatePayload : undefined;
    }

    function updateWithChangedValue(rawUpdateObj, key, baseAttrJson, updateAttrJson) {
        return (!_.isUndefined(rawUpdateObj) && _.has(rawUpdateObj, key) && !_.isEqual(baseAttrJson, updateAttrJson));
    }

    /*
     * Determine whether the specified property is 'read only' in the current jsonizing mode. It is readonly if
     * it there are no required or create/update settings, or if it is explicitly readonly.
     */
    function isReadOnly(propDef, mode) {
        var readOnly =
            (mode === 'create' &&
                ((_.isUndefined(propDef.create) && _.isUndefined(propDef.required)) ||
                    propDef.create === 'readonly')) ||
            (mode === 'update' &&
                ((_.isUndefined(propDef.update) && _.isUndefined(propDef.required)) ||
                    propDef.update === 'readonly'));
        return readOnly;
    }

    /*
     * Determine whether the specified property is 'required' given the specified jsonizing mode.
     */
    function isRequired(propDef, mode) {
        var required = (propDef.required === true) ||
            (propDef.create === 'required' && mode === 'create') ||
            (propDef.update === 'required' && mode === 'update');
        return required;
    }

    /*
     * Determine whether the specified property is one that allows null values
     */
    function isNullableType(propDef) {
        return _.isArray(propDef.type) ? _.contains(propDef.type, 'null') : (propDef.type === 'null');
    }

    function isEmbeddedProp(propDef) {
        return (propDef.type === 'object' && _.has(propDef, '$ref'));
    }

    function isObjectRefProp(propDef) {
        if (_.isArray(propDef.type)) {
            return _.contains(propDef.type, 'string') && propDef.format === 'objectReference';
        }
        return (propDef.type === 'string' && propDef.format === 'objectReference');
    }

    function throwIfBadNull(value, propDef, key) {
        if (dx.core.util.isNone(value) && !isNullableType(propDef)) {
            dx.fail('The attribute ' + key + ' is required to be non-null/non-undefined.');
        }
    }

    function isSchemaType(typeName) {
        return !!context._modelConstructors[typeName];
    }

    /*
     * ========================================
     * Actually do the work of this function
     * ========================================
     */

    context = context || this;
    context._modelConstructors = context._modelConstructors || {};
    context.rootOps = context.rootOps || {};

    _.each(schemas, function(schema, typeName) {
        var rwModel = {
            _dxSchema: schema,
            _dxIsReady: false,
            _dxErrorResult: undefined,
            _dxIsClientModel: false,
            _dxStandardOps: {},
            idAttribute: 'reference',
            urlRoot: schema.root,
            _dxSet: dxSet,
            _dxClear: dxClear,
            _dxFetch: dxFetch,
            _dxGetUrl : dxUrl,
            _dxMakeReady: function() {
                makeReady(this, false);
            },
            on: dxOn,
            get: dxGet,
            set: dxSet,
            has: dxHas,
            unset: dxUnset,
            clear: dxClear,
            toJSON: dxToJSON,
            fetch: noFetch,
            save: noSave,
            destroy: noDestroy,
            parse: dxParse,
            clone: dxClone,
            instanceOf: instanceOf,
            isServerModel: isServerModel
        };

        function getRootUrl() {
            return schema.root;
        }

        addOperations(rwModel, schema.operations, '', '', true);

        if (schema.rootOperations) {
            /*
             * Root operations on singletons are, essentially object operations, as far as the client object model
             * is concerned. So, treat those root operations as object operations.  However, there are also some
             * singleton 'pseudo-objects' (e.g. delphix_common) which only exist to hold a few operations, so those we
             * put on the rootOps object.  These pseudo-objects all prefixed by 'delphix_'.
             */
            if (schema.singleton && schema.name.indexOf('delphix_') !== 0) {
                addOperations(rwModel, schema.rootOperations, '', '', false);
            } else {
                context.rootOps[typeName] = {};
                context.rootOps[typeName]._dxGetUrl = getRootUrl;
                addOperations(context.rootOps[typeName], schema.rootOperations, '', '', false);
            }
        }

        if (schema.create) {
            context.rootOps[typeName] = context.rootOps[typeName] || {};
            context.rootOps[typeName].$$create = function(payload, successError) {
                return dxCreate(schema.create, getRootUrl(), payload, successError);
            };
        }

        if (schema.delete) {
            rwModel._dxStandardOps.$$delete = dxDelete;
        }

        if (schema.update) {
            rwModel._dxStandardOps.$$update = dxUpdate;
        }

        context._modelConstructors[typeName] = Backbone.Model.extend(rwModel);
    });

    _.extend(context, {
        _checkAndConvertParameters: checkAndConvertParameters,
        _newServerModel: newServerModel,
        _newClientModel: newClientModel,
        _getRootType: getRootType,
        _convertXhrToErrorResult: convertXhrToErrorResult,
        _handleErrorResult: handleErrorResult
    });

    // Add a trivial function for reporting an ErrorResult.  This is added for testing and only if level3 isn't here.
    if (!context.reportErrorResult) {
        context.reportErrorResult = function() {};
    }
};

})();

},{}],8:[function(require,module,exports){
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

/*global dx, $, _, Backbone */

'use strict';

dx.namespace('dx.core.data');

(function() {

/*
 * This defines the public API of the Delphix Data System. It relies heavily on the infrastructure built in the
 * files containing the level 1 and level 2 code.
 *
 * This provides several public functions to get at Delphix-Schema-Based models and collections:
 *     newClientModel                  Returns a 'read/write' model of the specified schema type.
 *
 *     getServerModel                  Returns a 'read-only' model of the specified schema type which is kept in
 *                                     sync with the server as long as it remains a member of a Server Collection.
 *
 *     getServerSingleton              Returns a 'read-only' model of the specified schema type.
 *
 *     getServerCollection             Returns a 'read-only' collection which contains Server Models of a particular
 *                                     type.
 *
 *     getCreationListener             Register a creation listener for a particular type.
 *
 *     getCollectionTypeFromModelType  Returns the name of the collection type that the specified model type belongs to.
 *
 *     setErrorCallback                Set an error callback function that will be called by reportErrorResult on an
 *                                     error.
 *
 *     reportErrorResult               Convenience routine which will display an ErrorResult object to the user on the
 *                                     screen. This is mainly useful if you have an operation error handler which,
 *                                     after examining the ErrorResult model, you still wish to show it to the user.
 */
dx.core.data.setupDataSystem = function(schemas, context) {
    /*
     * Returns a new client model.
     *
     * typeName: The type of the model. If a DB2Container is desired, then DB2Container should be passed.
     */
    function newClientModel(typeName) {
        return context._newClientModel(typeName);
    }

    /*
     * Returns a Server Collection for the specified type.  Each call returns a new collection, which may contain
     * distinct elements from other collections of the same type.  The collection is 'read only', which means its
     * contents may not be directly manipulated. However, its contents may be changed with the $$list() operation on
     * the collection.
     *
     * typeName:    This should be the 'root type' for the collection type wanted. That is, if one wants a collection
     *              of DB2Containers, one should pass 'Container' here.
     * resetOnList: If true, $$list()'s will only trigger a single 'reset' event rather than individual 'add' and
     *              'remove' events. Otherwise this happens only when the $$list() fully replaces the contents of the
     *              collection.
     */
    function getServerCollection(typeName, resetOnList) {
        var collection = context._newServerCollection(typeName, resetOnList);
        context._modelSubscribersStore.add(collection);
        return collection;
    }

    /*
     * Returns a creation listener for the specified type. Each call returns a new listener, which must be disposed
     * so as to free resources.
     *
     *   typeName       The schema type for which one receives notifications.
     *
     *   callback       A function to be invoked with a level2 model as argument for each create notification.
     *
     *   queryParams    Optional query parameters used to filter notifications.
     */
    function getCreationListener(settings) {
        if (dx.core.util.isNone(settings)) {
            dx.fail('Settings must be specified.');
        }
        _.extend(settings, {
            context: context
        });
        var creationListener = new dx.core.data.CreationListener(settings);
        context._modelSubscribersStore.add(creationListener);
        return creationListener;
    }

    /*
     * Returns the Server Model representing the specified singleton. If it already exists in the set of models the data
     * system is maintaining, that same instance will be returned. Otherwise a new instance will be returned and its
     * data asynchronously retrieved from the server.
     *
     * typeName:     The name of the type to fetch
     * options:      An object that may contain success and/or error callback functions. If the model is already present
     *               success will be invoked immediately. If it isn't present, success or error will be called once the
     *               underlying fetch has been completed. Additionally, one may set suppressDefaultErrorHandler as an
     *               option here to prevent the default error handler from being executed on error.
     */
    function getServerSingleton(typeName, options) {
        options = _.extend(_.clone(options || {}), {
            update: !context.notification.isStarted()
        });
        var model = context._cache.getCachedSingleton(typeName, options);

        if (!context.notification.isStarted()) {
            model._dxIsReady = false;   // if someone sets a ready handler, don't let it fire until new data is back
        }

        return model;
    }

    /*
     * Return the Server Model instance with the specified reference and of the specified type. If the model already
     * is being maintained by the data system, this will return the same instance. If not, a new instance will be
     * returned, and a request to populate it from data on the server.  To determine if the model has at least an
     * initial set of data, one should assign a 'ready' event handler (probably with the once() function).
     *
     * reference:    The reference for the model
     * typeName:     The type for the model. If the desired model is a DB2Container, can be 'Container' or
     *               'DB2Container'. If the type is not known, assume the most general root type ('Container') should be
     *               passed.
     * suppressDefaultErrorHandler:      If truthy, the default error handled is not triggered on errors.
     */
    function getServerModel(reference, typeName, suppressDefaultErrorHandler) {
        var model = context._cache.getCachedModel(reference, typeName,
            { suppressDefaultErrorHandler: suppressDefaultErrorHandler });

        if (!context.notification.isStarted()) {
            model._dxIsReady = false;   // if someone sets a ready handler, don't let it fire until new data is back
            model._dxFetch({ suppressDefaultErrorHandler: suppressDefaultErrorHandler });
        }

        return model;
    }

    /*
     * Gets a server model and returns a jQuery Promise.
     * This promise is resolved with the model if/when the model's ready' event is triggered.
     * It is rejected if/when the model's 'error' event is triggered.
     * For a description of the parameters see context.getServerModel()
     */
    function getServerModelPromise(reference, typeName, suppressDefaultErrorHandler) {
        var deferred = new $.Deferred();
        var model = context.getServerModel(reference, typeName, suppressDefaultErrorHandler);

        return setupPromise(model, deferred);
    }

    /*
     * Gets a server singleton and returns a jQuery Promise.
     * This promise is resolved with the singleton if/when the model's ready' event is triggered.
     * It is rejected if/when the singleton's 'error' event is triggered.
     * For a description of the parameters see context.getServerSingleton()
     */
    function getServerSingletonPromise(typeName, successError) {
        var deferred = new $.Deferred();
        var model = context.getServerSingleton(typeName, successError);

        return setupPromise(model, deferred);
    }

    /*
     * Helper function for getServerModelPromise and getServerSingletonPromise.
     * Note: This is exposed as _setupPromise for testing purposes only.
     */
    function setupPromise(model, deferred) {
        function onReadyCallback() {
            deferred.resolve(model);
        }
        function onErrorCallback() {
            deferred.reject(model);
        }

        model.once('ready', onReadyCallback);
        model.once('error', onErrorCallback);

        // use promise() to lock to deferred, exposing only methods to attach callbacks
        return deferred.promise();
    }

    /*
     * Given a model type, return the name of the 'root type'. Given DB2Container, OracleContainer, or Container, this
     * will return Container.
     */
    function getCollectionTypeFromModelType(modelType) {
        return context._getRootType(modelType);
    }

    /*
     * Sets an error callback that will be called by reportErrorResult. This is useful for an external system to define
     * behavior that will be used by the dxData system when an ErrorResult is reported by an operation
     */
    var errorCallback;
    function setErrorCallback(func) {
        if (!_.isFunction(func)) {
            dx.fail('setErrorCallback expects a function as an argument.');
        }
        errorCallback = func;
    }

    /*
     * Reports an ErrorResult model to the end user in the best fashion available at this time.
     */
    function reportErrorResult(errorResult) {
        if (!(errorResult instanceof Backbone.Model) || errorResult.get('type') !== 'ErrorResult') {
            dx.fail('reportErrorResult expects an ErrorResult model as an argument.');
        }

        // errorCallback is set by an external source using setErrorCallback
        if (errorCallback) {
            errorCallback(errorResult);
        }

        dx.warn('Error result: ' + JSON.stringify(errorResult.toJSON()));
    }

    /*
     * Start the real work here. Initialize everything 'below' us.
     */
    context = context || this;
    var parsedSchemas = dx.core.data._prepareSchemas(schemas);
    var enums = dx.core.data._prepareEnums(parsedSchemas);
    dx.core.data._initCache(context);
    dx.core.data._initFilters(context);
    dx.core.data._generateModelConstructors(parsedSchemas, context);
    dx.core.data._generateCollectionConstructors(parsedSchemas, context);
    dx.core.data._setupNotificationSystem(context);

    _.extend(context, {
        parsedSchemas: parsedSchemas,
        enums: enums,
        getServerCollection: getServerCollection,
        getCreationListener: getCreationListener,
        getServerSingleton: getServerSingleton,
        newClientModel: newClientModel,
        getServerModel: getServerModel,
        setErrorCallback: setErrorCallback,
        getServerModelPromise: getServerModelPromise,
        getServerSingletonPromise: getServerSingletonPromise,
        _setupPromise: setupPromise, // Exposed for testing purposes
        reportErrorResult: reportErrorResult,
        getCollectionTypeFromModelType: getCollectionTypeFromModelType
    });
};

})();

},{}],9:[function(require,module,exports){
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
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global dx, _ */

'use strict';

dx.namespace('dx.core.data');

/*
 * This notification system receives updates from the server about objects that have been created, deleted or updated.
 * This system, in turn, converts those notifications into calls to the underlying cache system so all models and
 * collections being used are up to date with whatever information is in the server.  Without the notification system
 * turned on, the models and collections are not assured of being up to date with what the server knows about.
 *
 * To use the notification system, simply call the start() function at the start of your program. To stop receiving
 * notifications, call stop(). You can also call isStarted() to verify whether the notification system is turned on.
 */
(function() {

dx.core.data._setupNotificationSystem = function(context) {

    /*
     * We use long polling to fetch notifications. We want to make sure our timeout is less than the browser timeout,
     * but otherwise the call will return as soon as data is available.
     */
    var TIMEOUT_SEC = 12;

    /*
     * If the call fails, we don't want to spin in a loop retrying. Attempt a new request after this time period.
     */
    var RETRY_SEC = 10;

    var date = new Date();
    var timeout;
    var stopped = true;
    var notification;
    var notificationChannel = date.getTime() + '_html';

    function processNotifications(notifications) {
        var uniqueObjectNotifications = {};
        var uniqueSingletonNotifications = {};

        /*
         * Pre-process notifications. Keep only the last notification for a particular object. Thus, should we receive a
         * create, update and delete notification for an object, we will only keep the delete. This assumes that we
         * never get a non-delete notification after getting a delete notification.
         */
        notifications.each(function(model) {
            switch (model.get('type')) {
                case 'ObjectNotification':
                    var reference = model.get('object');
                    uniqueObjectNotifications[reference] = model;
                    break;
                case 'SingletonUpdate':
                    var type = model.get('objectType');
                    if (!_.has(uniqueSingletonNotifications, type)) {
                        uniqueSingletonNotifications[type] = model;
                    }
                    break;
                case 'NotificationDrop':
                    dx.core.util.reloadClient(dx.gls('dx.notification_drop', model.get('dropCount')));
                    break;
                // we ignore all other types
            }
        });

        /*
         * With the uniquified set of object notifications, loop through them and retrieve or delete our copies of the
         * objects on the server
         */
        _.each(uniqueObjectNotifications, function(notification, objRef) {
            try {
                var type = notification.get('objectType');
                var rootType = context.getCollectionTypeFromModelType(type);

                switch (notification.get('eventType')) {
                    case 'CREATE':
                    case 'UPDATE':
                        var subscriptionUsesModel = context._modelSubscribersStore.hasType(rootType);
                        var hasModel = context._cache.containsCachedModel(objRef, rootType);
                        if (subscriptionUsesModel || hasModel) {
                            var model = context._cache.getCachedModel(objRef, rootType, {
                                update: true,
                                cacheOnlyIfNeeded: true,
                                suppressDefaultErrorHandler: true
                            });
                            model.once('error', function(model, err) {
                                dx.warn('Got an error when doing a ' + notification.get('eventType') + ' on ' +
                                    objRef + '.', err.toJSON());
                            });
                        }
                        break;
                    case 'DELETE':
                        context._cache.deleteCachedModel(objRef, rootType);
                        break;
                    default:
                        dx.warn('Unknown event type: ' + notification.get('eventType'));
                }
            } catch (e) {
                // We really don't want notification processing to stop, so swallow any exception and keep going
                dx.warn('notification processing failed: ' + e.message);
            }
        });

        /*
         * Finally, update all the singletons that have been changed, as well.
         */
        _.each(uniqueSingletonNotifications, function(notification, type) {
            try {
                context._cache.getCachedSingleton(type, {update: true});
            } catch (e) {
                // We really don't want notification processing to stop, so swallow any exception and keep going
                dx.warn('notification processing failed: ' + e.message);
            }
        });
    }

    function fetchNotifications() {
        timeout = undefined;

        notification.$$list({
            timeout: '' + TIMEOUT_SEC * 1000,
            channel: notificationChannel
        }, {
            success: function() {
                // We want to make sure notifications don't ever stall, even if there is some unknown problem
                if (!stopped) {
                    try {
                        processNotifications(notification);
                    } finally {
                        fetchNotifications();
                    }
                }
            },
            error: function() {
                if (!stopped) {
                    dx.warn('Notification call failed.');
                }

                if (stopped) {
                    return;
                }

                timeout = setTimeout(fetchNotifications, RETRY_SEC * 1000);
            }
        });
    }

    /*
     * For testing purposes. This returns the timeout used for retries for predictable results.
     */
    function _getRetryTimeout() {
        return RETRY_SEC * 1000;
    }

    function start() {
        if (_.isUndefined(notification)) {
            notification = context.getServerCollection('Notification');
        } else {
            dx.fail('Notification system already started.');
        }
        stopped = false;
        fetchNotifications();
    }

    function isStarted() {
        return !stopped;
    }

    function stop() {
        if (notification) {
            notification = undefined;
        }
        if (timeout) {
            clearTimeout(timeout);
        }
        stopped = true;
    }

    context = context || dx.core.data;
    context.notification = context.notification || {};
    _.extend(context.notification, {
        _getRetryTimeout: _getRetryTimeout,
        start: start,
        isStarted: isStarted,
        stop: stop
    });
};

})();

},{}]},{},[1,2,3,4,5,6,7,8,9])
//# sourceMappingURL=dxData.js.map

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

/*global dx, _ */

'use strict';

dx.namespace('dx.test');

/*
 * ServerCore provides support for all the data management required of a Delphix Schema-based server (storing objects,
 * responding to operations). It is intended to be used as a base type for various mock servers, allowing subtypes to
 * provide specialized server behavior without needing to re-invent the data and operation management.
 * ServerCore provides support for storing Delphix Schema defined singleton objects and collections of objects, as
 * well as support for the operations defined by those schemas, including  standard operations (read, list, create,
 * update, delete), object operations, and root operations.
 *
 * DATA
 *      createObjects()
 *      updateObjects()
 *      deleteObjects()
 *
 * These three routines add, update and delete objects and singletons in the server, respectively. By default, each
 * also creates the appropriate Notification objects (e.g. object creation notifications) for non-singleton objects,
 * though this can be overridden with a second argument.  The first argument to each can be either an object or an
 * array.
 *
 * When it is an object, it must have this structure:
 *    {
 *        TypeName : [ {
 *            { ... properties ... },
 *            { ... properties ... },
 *            ...
 *        } ],
 *        TypeName : { ... properties ... },
 *        ...
 *    }
 * Each of the "{ ... properties ... }" in the above description is a collection of properties for a particular
 * object instance as defined by the corresponding schema (but it need not be all the properties).
 * TypeName is either a singleton type name, or the name of a type that has a root property or a type descended from
 * a type with a root property.
 * If the individual objects do not have a type property, one will be added using the TypeName value.
 *
 * When it is an array, then it must have this structure:
 *    [{ ... properties ... }, { ... properties ... }, ...]
 *
 * There are some special cases for each of the three functions. In particular:
 *  - createObjects() will automatically add a generated reference property if the object type allows it and one isn't
 *                    provided in the "{ ... properties ... }" declaration
 *  - updateObjects() requires that there be a reference property in each object declaration.
 *  - deleteObjects() Requires a reference property. It can also accept an array of raw object references rather than
 *                    a whole object definition when the argument is an array.
 *
 * Note that these do not do full validation of the values passed in, so if dx.core.data calls fail reporting that
 * invalid properties were received, you should check your object definitions.
 *
 *      getSingleton()
 *      getObject()
 *      getCollection()
 *      clearCollection()
 *      getCollectionLength()
 *
 * These provide access to copies of the objects within the server.
 *
 * OPERATIONS
 *      addResources()
 *
 * This is used to register values that should be returned when a particular URL is GET'ed from the server.
 *
 *      addStandardOpHandlers()
 *      addStandardOpHandler()
 *      addRootOpHandlers()
 *      addRootOpHandler()
 *      addObjectOpHandlers()
 *      addObjectOpHandler()
 *
 * These are used to set up handlers for Standard Operations (list, read, create, update, delete), root operations and
 * object operations as defined by the schemas. The plural forms all take arguments in this form:
 *    {
 *        RootTypeName : {
 *            opName: function() {},
 *            ...
 *        },
 *        ...
 *    }
 * After the operation handler has been installed, any call to that operation on the server will invoke the handler.
 * Note that if a handler already exists in the server, a second addFooOperation call will replace the first.
 * The singular forms all take arguments in this form:
 *    addFooOperation(RootTypeName, operationName, function() {});
 *
 * The handlers take one of the following signatures:
 *    objectHandler(reference, payload, Result, server)
 *        This is for object operations, read, update and delete standard operations.
 *    otherHandler(payload, Result, server);
 *        This is for root operations, list and create standard ops, and singleton read, update and create operations.
 *
 *        reference: The reference of the object being manipulated
 *        payload: The payload of the call (or query parameters)
 *        Result: A constructor function for returning a value. See below
 *        server: A reference to the server making this call to the routine.
 *
 * Each of these functions must return either an arbitrary value, or a Result instance.  If a non-Result instance is
 * returned, the server assumes that it is a successful result, and calls new Result.OkResult(returnValue) for you.
 *
 *     Result(statusCode, data)
 *     Result.OkResult(okResultResult)
 *     Result.ListResult(listResultResult)
 *     Result.ErrorResult(statusCode, errorResultError)
 *     Result.MissingObjResult(type, reference, operation)
 *
 * These constructor functions generate Result instances with an HTTP Status Code and data to be returned to the caller.
 * Result() is the most generic and returns in the body whatever is in the second parameter.
 *
 * URL ACCESS
 *
 *     GET(url, parameters)
 *     POST(url, payload)
 *     DELETE(url, payload)
 *
 * These three routines let you do the equivalent of an HTTP GET, POST or DELETE on the server to the specified URL
 * with the named parameters or payload.  Each returns an object with a statusCode and data property. If the specified
 * url isn't supported by the server, then the return value is equivalent to new Result(server.UNKNOWN_URL_STATUS,
 * undefined);
 */
(function() {

var OBJECT_OPERATION_REGX = new RegExp('(^.*)/([^/]+)/([^/]+)(\\?[^/]+)?$');   // anything/objref/operation?params
var OBJECT_READ_UPDATE_DELETE_REGEX = new RegExp('(^.*)/([^/]+)$');       // anything/something
var INLINE_REF = '/{ref}/';
var TRAILING_REF = '/{ref}';
var START_REF = 1000;
var STANDARD_OPERATONS = ['list', 'read', 'create', 'update', 'delete'];

/*
 * Creates a set of objects in the mock server that can be accessed and manipulated by other operations on the mock
 * server.
 *
 * The parameters for this are discussed in the header comment to this file.
 *
 * Note:
 *   * In all cases, if the object type allows for a reference property, and that is not included in the object
 *     structure, then this will automatically add one.
 *   * If the object type has a reference, then a corresponding CREATE notification object will be automatically created
 *     unless skipNotifications is true.
 *   * You can "create" a singleton with this call. In that case, it will simply behave the same as an update.
 */
function createObjects(server, newObjects, skipNotifications) {
    return processArgumentsWithHandler(newObjects, skipNotifications, _.partial(createObject, server));
}

/*
 * Given an object, do the following:
 *   - Convert its properties to a JSON-compatible format
 *   - Make sure it is a known schema object type
 *   - Make sure it is a singleton or belongs to a type with a root property
 *   - Add a reference  if appropriate
 *   - Add the object to the mock server's internal cache of objects, replacing any instance already there
 *   - Generate object creation or singleton update notifications if appropriate
 */
function createObject(server, newObject, skipNotification) {
    if (!newObject.type) {
        dx.fail('No type property found on object.', newObject);
    }

    var schema = server._schemasByName[newObject.type];
    if (!schema) {
        dx.fail(newObject.type + ' is not a known schema type.');
    }

    if (schema.singleton) {
        server._singletons[newObject.type] = newObject;

        if (!skipNotification) {
            postNotifications(server, [{
                type: 'SingletonUpdate',
                objectType: newObject.type
            }]);
        }
    } else {
        var rootType = getRootTypeForObject(schema, server._schemasByName);
        var shouldHaveReference = !!getPropDef(schema, 'reference', server._schemasByName);

        if (!rootType) {
            dx.fail(newObject.type + ' is not a type descended from one with a root property.');
        }

        server._objects[rootType] = server._objects[rootType] || [];
        server._objects[rootType].push(newObject);

        if (shouldHaveReference && !newObject.reference) {
            newObject.reference = newObject.type.toUpperCase() + '-' + server._nextReference;
            server._nextReference++;
        }

        // Notifications only make sense for an object with a reference
        if (newObject.reference && !skipNotification) {
            postNotifications(server, [{
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: newObject.type,
                object: newObject.reference
            }]);
        }

        return newObject.reference;
    }
}

/*
 * Updates a set of objects in the mock server.
 *
 * The parameters for this are discussed in the header comment to this file.
 *
 * Note:
 *   * All non-singleton objects MUST have a reference property set.
 *   * If the object type has a reference or is a singleton, then a corresponding UPDATE notification object will be
 *     automatically created unless skipNotifications is true.
 */
function updateObjects(server, objectsToUpdate, skipNotifications) {
    processArgumentsWithHandler(objectsToUpdate, skipNotifications, _.partial(updateObject, server));
}

function updateObject(server, newObject, skipNotification) {
    var schema = server._schemasByName[newObject.type];

    if (schema && schema.singleton) {
        updateObjectProperties(server, getSingleton(server, newObject.type), newObject);

        if (!skipNotification) {
            postNotifications(server, [{
                type: 'SingletonUpdate',
                objectType: newObject.type
            }]);
        }
    } else {
        if (!newObject.reference) {
            dx.fail('Can not update an object without at least a reference.');
        }
        var existing = getObject(server, newObject.reference);

        if (!existing) {
            dx.fail('There is no object with the reference ' + newObject.reference + ' to update.');
        }

        updateObjectProperties(server, existing, newObject);

        if (!skipNotification) {
            postNotifications(server, [{
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: existing.type,
                object: existing.reference
            }]);
        }
    }
}

/*
 * Overlays the target with the new properties while being aware of the fact that objects that have no schema type
 * associated with them should be treated as an "atomic" value and not overlaid but rather replaced as a unit.
 */
function updateObjectProperties(server, targetObject, newProperties) {
    _.each(newProperties, function(propval, propname) {
        if (_.isObject(propval)) {
            var schema = server._schemasByName[targetObject.type];
            var propDef = getPropDef(schema, propname, server._schemasByName);

            if (propDef && propDef.$ref) {
                if (!_.isObject(targetObject[propname])) {
                    targetObject[propname] = {};
                }
                updateObjectProperties(server, targetObject[propname], propval);
                propval = targetObject[propname];
            }
        }
        targetObject[propname] = propval;
    });

    return targetObject;
}

/*
 * Deletes a set of objects in the mock server.
 *
 * The parameters for this are discussed in the header comment to this file.
 * In addition, if the objectsToDelete is an array, you can simply specify an array of references:
 *    deleteObjects(['REF-1', 'REF-2', 'REF-3'...])
 * This is, far and away, the most common use of this.
 *
 * Note:
 *   * This will throw an error if you try to delete a Singleton.
 *   * All objects MUST have a reference property set.
 *   * A corresponding DELETE notification object will be automatically created unless skipNotifications is true.
 */
function deleteObjects(server, objectsToDelete, skipNotifications) {
    processArgumentsWithHandler(objectsToDelete, skipNotifications, _.partial(deleteObject, server));
}

function deleteObject(server, doomedObjectOrRef, skipNotifications) {
    var targetReference = doomedObjectOrRef;

    if (_.isObject(doomedObjectOrRef)) {
        targetReference = doomedObjectOrRef.reference;
    }

    if (!targetReference) {
        dx.fail('No reference provided to identify the object to delete.');
    }

    if (isSingleton(server, targetReference)) {
        dx.fail('Can not delete singletons (' + targetReference + ' is a singleton).');
    }

    var deletedIt = _.find(server._objects, function(objectsArray) {
        return _.find(objectsArray, function(anObject, index) {
            if (anObject.reference === targetReference) {
                objectsArray.splice(index, 1);

                if (!skipNotifications) {
                    postNotifications(server, [{
                        type: 'ObjectNotification',
                        eventType: 'DELETE',
                        objectType: anObject.type,
                        object: anObject.reference
                    }]);
                }

                return true;
            }
        });
    });

    if (!deletedIt) {
        dx.fail('Could not find ' + targetReference + ' to delete it.');
    }
}

/*
 * Routine that process arguments to several input routines in a uniform way.  The arguments may be in one of two
 * forms:
 *    [{ ... properties ... }, { ... properties ... } ...]
 *  or
 *    {
 *        RootTypeName: [{ ... properties ... }, { ... properties ... } ...],
 *        RootTypeName: [{ ... properties ... }, { ... properties ... } ...],
 *        ...
 *    }
 * This will walk through each set of object properties, and call the specified handler with that set of properties
 * and the skipNotifications parameter.  In the case of the latter style, a type property will be added to each
 * individual object if it does not already have one.
 */
function processArgumentsWithHandler(objectsToProcess, skipNotifications, handler) {
    var copyOfObjects = deepClone(objectsToProcess);
    var result = [];

    if (_.isArray(copyOfObjects)) {
        for (var index = 0; index < copyOfObjects.length; index++) {
            result.push(handler(copyOfObjects[index], skipNotifications));
        }
    } else {
        _.each(copyOfObjects, function(objectOrArray, typeName) {
            if (_.isArray(objectOrArray)) {
                for (var ctr = 0; ctr < objectOrArray.length; ctr++) {
                    var anObject = objectOrArray[ctr];
                    anObject.type = anObject.type || typeName;
                    result.push(handler(anObject, skipNotifications));
                }
            } else {
                objectOrArray.type = objectOrArray.type || typeName;
                result.push(handler(objectOrArray, skipNotifications));
            }
        });
    }

    return result;
}

/*
 * Helper function to post an array of notifications.
 */
function postNotifications(server, notifications) {
    server.createObjects({
        Notification: notifications
    }, true);
}

/*
 * Returns the object with the specified reference, or undefined if no such object. If a type is specified, this may
 * use a faster algorithm to look up the object. This does not return singletons.
 */
function getObject(server, objectRef, typeName) {
    if (typeName) {
        var schema = server._schemasByName[typeName];
        if (!schema) {
            dx.fail(typeName + ' is not a known type.');
        }
        var rootTypeName = getRootTypeForObject(schema, server._schemasByName);
        if (!rootTypeName) {
            dx.fail('Can only ask for objects in collections with a root property with getObject().');
        }
        if (rootTypeName !== schema.name) {
            dx.fail('Must specify the root type (' + rootTypeName + ') if a type is specified to getObject().');
        }

        return _.find(server._objects[typeName], function(obj) {
            return obj.reference === objectRef;
        });
    }

    var matchedObject;
    _.find(server._objects, function(collection) {
        matchedObject = _.find(collection, function(anObject) {
            return anObject.reference === objectRef;
        });
        return matchedObject;
    });
    return matchedObject;
}

/*
 * Returns the collection of objects for the specified type. Note that the type must be a root type
 */
function getCollection(server, typeName) {
    var schema = server._schemasByName[typeName];
    if (!schema) {
        dx.fail(typeName + ' is not a known type.');
    }
    if (schema.singleton) {
        dx.fail(typeName + ' is a singleton type, not a collection type.');
    }
    var rootTypeName = getRootTypeForObject(schema, server._schemasByName);
    if (!rootTypeName) {
        dx.fail('Can only ask for collections with a root property.');
    }
    if (rootTypeName !== schema.name) {
        dx.fail('Must specify the root type (' + rootTypeName + ').');
    }

    return server._objects[typeName] || [];
}

/*
 * Returns the specified singleton from the server
 */
function getSingleton(server, typeName) {
    if (!isSingleton(server, typeName)) {
        dx.fail(typeName + ' is not a singleton type.');
    }

    if (!server._singletons[typeName]) {
        server._singletons[typeName] = {
            type: typeName
        };
    }

    return server._singletons[typeName];
}

function isSingleton(server, typeName) {
    var schema = server._schemasByName[typeName];
    return schema && schema.singleton;
}

/*
 * Removes all the elements from the specified collection. No notifications are generated.
 */
function clearCollection(server, typeName) {
    var collection = getCollection(server, typeName);
    collection.length = 0;
}

function getCollectionLength(server, typeName) {
    var collection = getCollection(server, typeName);
    return collection.length;
}

/*
 * Sets the 'standard (CRUD) object operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 *
 * You may override any of the standard operations that are supported for a given type. ServerCore already provides
 * default implementations of these handlers, but overriding these may be useful in certain cases, such as testing
 * various failure scenarious as well as being able to spy on these operations.
 * Any operations defined in the parameter will replace their equivalents already installed in the mock server, if any.
 */
function addStandardOpHandlers(server, operationHash) {
    if (!_.isObject(operationHash)) {
        dx.fail('Expected an object, but got ' + JSON.stringify(operationHash) + '.');
    }

    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addStandardOpHandler(server, type, oName, oFunc);
        });
    });
}

/*
 * Like addStandardOpHandlers(), but instead adds a single operation.
 */
function addStandardOpHandler(server, typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dx.fail('Expected a string as a type name, but got ' + JSON.stringify(typeName) + '.');
    }
    if (!_.isString(opName)) {
        dx.fail('Expected a string as an operation name, but got ' + JSON.stringify(opName) + '.');
    }
    if (!_.isFunction(opHandler)) {
        dx.fail('Expected a function for the handler, but got ' + JSON.stringify(opHandler) + '.');
    }
    if (!server._schemasByName[typeName]) {
        dx.fail(typeName + ' is not a schema type.');
    }
    if (!_.contains(STANDARD_OPERATONS, opName)) {
        dx.fail(opName + ' is not one of the standard operations (' + STANDARD_OPERATONS.join(', ') + ').');
    }
    if (!server._schemasByName[typeName][opName]) {
        dx.fail(opName + ' is not a standard operation on ' + typeName + '.');
    }

    server._customStdHandlers[typeName] = server._customStdHandlers[typeName] || {};
    server._customStdHandlers[typeName][opName] = opHandler;
}

/*
 * Sets the 'root operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 */
function addRootOpHandlers(server, operationHash) {
    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addRootOpHandler(server, type, oName, oFunc);
        });
    });
}

/*
 * Like addRootOpHandlers(), but instead adds a single operation.
 */
function addRootOpHandler(server, typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dx.fail('Expected a string as a type name, but got ' + JSON.stringify(typeName) + '.');
    }
    if (!_.isString(opName)) {
        dx.fail('Expected a string as an operation name, but got ' + JSON.stringify(opName) + '.');
    }
    if (!_.isFunction(opHandler)) {
        dx.fail('Expected a function for the handler, but got ' + JSON.stringify(opHandler) + '.');
    }
    if (!server._schemasByName[typeName]) {
        dx.fail(typeName + ' is not a schema type.');
    }
    if (!server._schemasByName[typeName].rootOperations || !server._schemasByName[typeName].rootOperations[opName]) {
        dx.fail(opName + ' is not a root operation on ' + typeName + '.');
    }

    server._customRootHandlers[typeName] = server._customRootHandlers[typeName] || {};
    server._customRootHandlers[typeName][opName] = opHandler;
}

/*
 * Adds one or more 'object operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 */
function addObjectOpHandlers(server, operationHash) {
    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addObjectOpHandler(server, type, oName, oFunc);
        });
    });
}

/*
 * Like addObjectOpHandlers(), but instead adds a single operation.
 */
function addObjectOpHandler(server, typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dx.fail('Expected a string as a type name, but got ' + JSON.stringify(typeName) + '.');
    }
    if (!_.isString(opName)) {
        dx.fail('Expected a string as an operation name, but got ' + JSON.stringify(opName) + '.');
    }
    if (!_.isFunction(opHandler)) {
        dx.fail('Expected a function for the handler, but got ' + JSON.stringify(opHandler) + '.');
    }
    if (!server._schemasByName[typeName]) {
        dx.fail(typeName + ' is not a schema type.');
    }
    if (!server._schemasByName[typeName].operations || !server._schemasByName[typeName].operations[opName]) {
        dx.fail(opName + ' is not an object operation on ' + typeName + '.');
    }

    server._customObjHandlers[typeName] = server._customObjHandlers[typeName] || {};
    server._customObjHandlers[typeName][opName] = opHandler;
}

/*
 * Adds resources that can be called from a test.  In this case, a resource is an arbitrary string associated with
 * the full path portion of a URL.  This can be useful, for example, to register templates with the mock server that
 * can then be requested from a test.
 *
 * For example, this might be called with:
 * {
 *     '/test/template/basic.hjs': '<div id=basicTest></div>'
 * }
 */
function addResources(server, resourcesHash) {
    _.extend(server._resources, resourcesHash);
}

function HttpGet(server, url, payload) {
    return HttpOperation(server, 'GET', url, payload);
}

function HttpPost(server, url, payload) {
    return HttpOperation(server, 'POST', url, payload);
}

function HttpDelete(server, url, payload) {
    return HttpOperation(server, 'DELETE', url, payload);
}

function HttpOperation(server, method, url, payloadOrParams) {
    var result;
    var path = method + ':' + url;

    if (_.isString(payloadOrParams)) {
        payloadOrParams = JSON.parse(payloadOrParams);
    }

    // Look at the URL and identify candidate handlers.
    var objectOpMatch = OBJECT_OPERATION_REGX.exec(path);
    var objectOpPath = objectOpMatch ? objectOpMatch[1] + INLINE_REF + objectOpMatch[3] : '';
    var objectOpRef = objectOpMatch ? objectOpMatch[2] : '';
    var objectOpHandler = server._builtinHandlers[objectOpPath];

    var objectRUDMatch = OBJECT_READ_UPDATE_DELETE_REGEX.exec(path);
    var objectRUDPath = objectRUDMatch[1] + TRAILING_REF;
    var objectRUDRef = objectRUDMatch[2];
    var objectRUDHandler = server._builtinHandlers[objectRUDPath];

    if (objectOpHandler) {
        result = objectOpHandler(objectOpRef, payloadOrParams, Result, server);
    } else if (server._builtinHandlers[path]) {
        result = server._builtinHandlers[path](payloadOrParams, Result, server);
    } else if (objectRUDHandler) {
        result = objectRUDHandler(objectRUDRef, payloadOrParams, Result, server);
    } else if (server._resources[url] && method === 'GET') {
        result = new Result(200, server._resources[url]);
    } else {
        result = new Result(server.UNKNOWN_URL_STATUS, null);
    }

    // If a handler returned a non-Result, assume it is an OkResult body, and return that instead
    if (!(result instanceof Result)) {
        result = new Result.OkResult(result || null);
    }

    return result;
}

function buildHandlersForSingletonSchema(server, schema) {
    var singletoneType = schema.name;

    if (schema.read) {
        server._builtinHandlers['GET:' + schema.root] = function builtinSingleReadHandler(parameters, Result, server) {
            var customHandlers = server._customStdHandlers[singletoneType];
            if (customHandlers && customHandlers.read) {
                return customHandlers.read(parameters, Result, server) || new Result.OkResult({});
            }

            return new Result.OkResult(getSingleton(server, singletoneType));
        };
    }

    /*
     * Singletons can have only an update or a create, but not both (there is no reference property to distinguish them
     * as there is with ordinary objects)
     */
    if (schema.update || schema.create) {
        server._builtinHandlers['POST:' + schema.root] = function builtinSingleUpdateCreate(payload, Result, server) {
            var customHandlers = server._customStdHandlers[singletoneType];

            payload = deepClone(payload) || {};
            payload.type = singletoneType;

            if (schema.create) {
                if (customHandlers && customHandlers.create) {
                    return customHandlers.create(payload, Result, server);
                }

                createObject(server, payload);
            } else {
                if (customHandlers && customHandlers.update) {
                    return customHandlers.update(payload, Result, server);
                }

                updateObject(server, payload);
            }

            return new Result.OkResult(null);
        };
    }

    buildRootOperationHandlers(server, schema);
}

function buildHandlersForCollectionSchema(server, schema) {
    buildStandardOperationHandlers(server, schema);
    buildRootOperationHandlers(server, schema);
    buildOperationHandlers(server, schema);
}

function buildStandardOperationHandlers(server, schema) {
    var methodAndUrl;
    var typeName = schema.name;

    if (schema.list) {
        methodAndUrl = 'GET:' + schema.root;

        server._builtinHandlers[methodAndUrl] = function builtinListHandler(parameters, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];

            if (customHandlers && customHandlers.list) {
                var result = customHandlers.list(parameters, Result, server);

                // Special case. If the handler returned nothing or a non-result, return a ListResult
                result = result || [];
                if (!(result instanceof Result)) {
                    return new Result.ListResult(result);
                }

                return result;
            }

            var collection = getCollection(server, typeName);

            if (server._filters[typeName]) {
                collection = server._filters[typeName](collection, parameters || {}, typeName, server._schemasByName);
            }

            return new Result.ListResult(collection);
        };
    }

    if (schema.create) {
        methodAndUrl = 'POST:' + schema.root;

        server._builtinHandlers['POST:' + schema.root] = function builtinCreateHandler(payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            var targetType = typeName;
            var payloadSchema;
            var rootTypeName;

            if (customHandlers && customHandlers.create) {
                return customHandlers.create(payload, Result, server);
            }

            if (payload && payload.type) {
                targetType = payload.type;
            }
            payloadSchema = server._schemasByName[targetType];
            if (!payloadSchema) {
                dx.fail(targetType + ' is not a known schema type.');
            }
            rootTypeName = getRootTypeForObject(payloadSchema, server._schemasByName);
            if (rootTypeName !== typeName) {
                dx.fail('Trying to create a ' + typeName + ' but received a payload of type ' + payload.type +
                    '. Use addStandardOpHandlers() to roll your own create logic.');
            }

            var objectsToCreate = {};
            objectsToCreate[typeName] = [payload];

            var references = createObjects(server, objectsToCreate);

            return new Result.OkResult(references[0]);
        };
    }

    if (schema.read) {
        methodAndUrl = 'GET:' + schema.root + TRAILING_REF;

        server._builtinHandlers[methodAndUrl] = function builtinReadHandler(reference, payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            if (customHandlers && customHandlers.read) {
                return customHandlers.read(reference, payload, Result, server) || new Result.OkResult({});
            }

            var obj = getObject(server, reference, typeName);
            if (!obj) {
                return new Result.MissingObjResult(typeName, reference, 'read');
            }

            return new Result.OkResult(obj);
        };
    }

    if (schema.update) {
        methodAndUrl = 'POST:' + schema.root + TRAILING_REF;
        server._builtinHandlers[methodAndUrl] = function builtinUpdateHandler(reference, payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            if (customHandlers && customHandlers.update) {
                return customHandlers.update(reference, payload, Result, server);
            }

            if (!getObject(server, reference, typeName)) {
                return new Result.MissingObjResult(typeName, reference, 'update');
            }

            // 'reference' is inferred by the url and must not be part of the data already.
            payload = deepClone(payload);
            payload.reference = reference;

            updateObjects(server, [payload]);

            return new Result.OkResult(null);
        };
    }

    if (schema.delete) {
        methodAndUrl = 'DELETE:' + schema.root + TRAILING_REF;

        server._builtinHandlers[methodAndUrl] = function builtinDeleteHandler(reference, payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            if (customHandlers && customHandlers.delete) {
                return customHandlers.delete(reference, payload, Result, server);
            }

            if (!getObject(server, reference, typeName)) {
                return new Result.MissingObjResult(typeName, reference, 'delete');
            }

            deleteObjects(server, [reference]);

            return new Result.OkResult(null);
        };
    }
}

function buildOperationHandlers(server, schema) {
    _.each(schema.operations, function(opDef, operationName) {
        var httpMethod = opDef.payload ? 'POST' : 'GET';
        var methodAndUrl = httpMethod + ':' + schema.root + INLINE_REF + operationName;

        server._builtinHandlers[methodAndUrl] = function builtinObjHandler(objectRef, payloadOrParams, Result, server) {
            if (!getObject(server, objectRef, schema.name)) {
                return new Result.MissingObjResult(schema.name, objectRef, operationName);
            }

            var customHandlers = server._customObjHandlers[schema.name];
            if (customHandlers && customHandlers[operationName]) {
                return customHandlers[operationName](objectRef, payloadOrParams, Result, server);
            }

            dx.fail('Test called ' + schema.name + '.' + operationName + ', but no handler registered for it.');
        };
    });
}

function buildRootOperationHandlers(server, schema) {
    _.each(schema.rootOperations, function(opDef, operationName) {
        var httpMethod = opDef.payload ? 'POST' : 'GET';
        var methodAndUrl = httpMethod + ':' + schema.root + '/' + operationName;

        server._builtinHandlers[methodAndUrl] = function builtinRootOpHandler(payloadOrParams, Result, server) {
            var customHandlers = server._customRootHandlers[schema.name];
            if (customHandlers && customHandlers[operationName]) {
                return customHandlers[operationName](payloadOrParams, Result, server);
            }

            dx.fail('Test called ' + schema.name + '.' + operationName + ', but no handler registered for it.');
        };
    });
}

function Result(statusCode, data) {
    var self = this;

    if (!(self instanceof Result)) {
        dx.fail('Must call Result() with new.');
    }

    self.statusCode = statusCode;
    self.data = data;
}

function OkResult(data) {
    if (!(this instanceof OkResult)) {
        dx.fail('Must call Result.OkResult() with new.');
    }

    return new Result(200, {
        type: 'OKResult',
        result: data
    });
}

function ListResult(data) {
    if (!_.isArray(data)) {
        dx.fail('Must call Result.ListResult() with an array.');
    }
    if (!(this instanceof ListResult)) {
        dx.fail('Must call Result.ListResult() with new.');
    }

    return new Result(200, {
        type: 'ListResult',
        result: data
    });
}

function ErrorResult(statusCode, error) {
    if (!(this instanceof ErrorResult)) {
        dx.fail('Must call Result.ErrorResult() with new.');
    }

    return new Result(statusCode, {
        type: 'ErrorResult',
        status: 'ERROR',
        error: error
    });
}

function MissingObjResult(type, ref, operation) {
    if (!(this instanceof MissingObjResult)) {
        dx.fail('Must call Result.MissingObjResult() with new.');
    }

    return new ErrorResult(404, {
        type: 'APIError',
        details: type + '/' + ref + ' could not be found for ' + operation + '.',
        id: 'object.missing'
    });
}

_.extend(Result, {
    OkResult: OkResult,
    ListResult: ListResult,
    ErrorResult: ErrorResult,
    MissingObjResult: MissingObjResult
});

// Returns the property definition if instances of the specified schema have a specific property, undefined otherwise
function getPropDef(schema, propName, schemasByName) {
    if (schema.properties && schema.properties[propName]) {
        return schema.properties[propName];
    }

    if (schema.extends && schema.extends.$ref) {
        return getPropDef(schemasByName[schema.extends.$ref], propName, schemasByName);
    }
}

// Returns the name of the root type for the specified schema, or undefined.
function getRootTypeForObject(schema, schemasByName) {
    if (schema.root) {
        return schema.name;
    }

    if (schema.extends && schema.extends.$ref) {
        return getRootTypeForObject(schemasByName[schema.extends.$ref], schemasByName);
    }
}

function processSchemas(server, schemas) {
    function fixName(schemaKey) {
        return schemaKey.replace(/\.json$/, '')
            .replace(/-/g, '_')
            .replace(/\//g, '');
    }

    // Fix all the names for all the schemas, and store them by name
    _.each(schemas, function(schema, schemaKey) {
        // don't modify the original schema
        var schemaCopy = deepClone(schema);
        if (!schemaCopy.name) {
            schemaCopy.name = fixName(schemaKey);
        }
        server._schemasByName[schemaCopy.name] = schemaCopy;
    });

    // Fix internal references to the schemas and build the callback handlers for all operations.
    _.each(server._schemasByName, function(schema) {
        if (schema.extends) {
            schema.extends.$ref = fixName(schemas[schema.extends.$ref].name);
        }

        if (schema.root) {
            if (schema.singleton) {
                buildHandlersForSingletonSchema(server, schema);
            } else {
                buildHandlersForCollectionSchema(server, schema);
            }
        }
    });
}

/*
 * Does a deep clone of the specified object, but replaces Date instances with .toJSON() equivalents, and
 * undefined with null.
 */
function deepClone(obj) {
    var result = obj;

    if (_.isArray(obj)) {
        result = [];
        for (var index = 0; index < obj.length; index++) {
            result[index] = deepClone(obj[index]);
        }
    } else if (_.isObject(obj)) {
        if (_.isDate(obj)) {
            result = obj.toJSON();
        } else {
            result = {};
            _.each(obj, function(value, index) {
                if (_.isUndefined(value)) {
                    value = null;
                }
                result[index] = deepClone(value);
            });
        }
    }

    return result;
}

/*
 * Return a function that does a deep clone of the return value
 */
function deepCloneReturn(func, server) {
    return function() {
        // All our functions take the server as their first argument.
        Array.prototype.unshift.call(arguments, server);
        return deepClone(func.apply(server, arguments));
    };
}

function reset(server) {
    server._singletons = {};
    server._objects = {};
    server._nextReference = START_REF;
    server._resources = {};
    server._customObjHandlers = {};   // { type: { op: function() } }
    server._customRootHandlers = {};
    server._customStdHandlers = {};
}

/*
 * Document structure of schemas
 */
function ServerCore(schemas) {
    var self = this;
    if (!(self instanceof ServerCore)) {
        dx.fail('Must call ServerCore() with new.');
    }
    if (!schemas) {
        dx.fail('Must pass a map of schemas when constructing a ServerCore.');
    }

    self._schemasByName = {};
    self._builtinHandlers = {}; // 'HTTPMMETHOD:url': function()
    self._filters = [];
    reset(self);

    processSchemas(this, schemas);

    _.extend(self, {
        UNKNOWN_URL_STATUS: 1000,
        createObjects: _.partial(createObjects, self),
        updateObjects: _.partial(updateObjects, self),
        deleteObjects: _.partial(deleteObjects, self),
        getObject: deepCloneReturn(getObject, self),
        getSingleton: deepCloneReturn(getSingleton, self),
        getCollection: deepCloneReturn(getCollection, self),
        clearCollection: _.partial(clearCollection, self),
        getCollectionLength: _.partial(getCollectionLength, self),
        addStandardOpHandlers: _.partial(addStandardOpHandlers, self),
        addStandardOpHandler: _.partial(addStandardOpHandler, self),
        addRootOpHandlers: _.partial(addRootOpHandlers, self),
        addRootOpHandler: _.partial(addRootOpHandler, self),
        addObjectOpHandlers: _.partial(addObjectOpHandlers, self),
        addObjectOpHandler: _.partial(addObjectOpHandler, self),
        addResources: _.partial(addResources, self),
        GET: deepCloneReturn(HttpGet, self),
        POST: deepCloneReturn(HttpPost, self),
        DELETE: deepCloneReturn(HttpDelete, self),
        reset: _.partial(reset, self)
    });
}

dx.test.ServerCore = ServerCore;

})();

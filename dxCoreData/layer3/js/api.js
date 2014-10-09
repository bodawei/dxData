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

/*global dx, $, _, Backbone */

"use strict";

dx.namespace("dx.core.data");

(function() {

/*
 * This defines the public API of the Delphix Data System. It relies heavily on the infrastructure built in the
 * files containing the level 1 and level 2 code.
 *
 * This provides several public functions to get at Delphix-Schema-Based models and collections:
 *     newClientModel                  Returns a "read/write" model of the specified schema type.
 *
 *     getServerModel                  Returns a "read-only" model of the specified schema type which is kept in
 *                                     sync with the server as long as it remains a member of a Server Collection.
 *
 *     getServerSingleton              Returns a "read-only" model of the specified schema type.
 *
 *     getServerCollection             Returns a "read-only" collection which contains Server Models of a particular
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
dx.core.data.setupDataSystem = function(schemas, queryParamAnnotations, context) {
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
     * distinct elements from other collections of the same type.  The collection is "read only", which means its
     * contents may not be directly manipulated. However, its contents may be changed with the $$list() operation on
     * the collection.
     *
     * typeName:    This should be the "root type" for the collection type wanted. That is, if one wants a collection
     *              of DB2Containers, one should pass "Container" here.
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
            dx.fail("settings must be specified");
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
     * successError: An object that may contain success and/or error callback functions. If the model is already present
     *               success will be invoked immediately. If it isn't present, success or error will be called once the
     *               underlying fetch has been completed.
     */
    function getServerSingleton(typeName, successError) {
        successError = successError || {};
        var model = context._cache.getCachedSingleton(typeName, {
                update: !dx.core.data.notification.isStarted(),
                success: successError.success,
                error: successError.error
            });

        if (!dx.core.data.notification.isStarted()) {
            model._dxIsReady = false;   // if someone sets a ready handler, don't let it fire until new data is back
        }

        return model;
    }

    /*
     * Return the Server Model instance with the specified reference and of the specified type. If the model already
     * is being maintained by the data system, this will return the same instance. If not, a new instance will be
     * returned, and a request to populate it from data on the server.  To determine if the model has at least an
     * initial set of data, one should assign a "ready" event handler (probably with the once() function).
     *
     * reference:    The reference for the model
     * typeName:     The type for the model. If the desired model is a DB2Container, can be "Container" or
     *               "DB2Container". If the type is not known, assume the most general root type ("Container") should be
     *               passed.
     * suppressDefaultErrorHandler:      If truthy, the default error handled is not triggered on errors.
     */
    function getServerModel(reference, typeName, suppressDefaultErrorHandler) {
        var model = context._cache.getCachedModel(reference, typeName,
            { suppressDefaultErrorHandler: suppressDefaultErrorHandler });

        if (!dx.core.data.notification.isStarted()) {
            model._dxIsReady = false;   // if someone sets a ready handler, don't let it fire until new data is back
            model._dxFetch({ suppressDefaultErrorHandler: suppressDefaultErrorHandler });
        }

        return model;
    }

    /*
     * Gets a server model and returns a jQuery Promise.
     * This promise is resolved with the model if/when the model's ready' event is triggered.
     * It is rejected if/when the model's 'error' event is triggered.
     * For a description of the parameters see dx.core.data.getServerModel()
     */
    function getServerModelPromise(reference, typeName, successError) {
        var deferred = new $.Deferred();
        var model = context.getServerModel(reference, typeName, successError);

        return setupPromise(model, deferred);
    }

    /*
     * Gets a server singleton and returns a jQuery Promise.
     * This promise is resolved with the singleton if/when the model's ready' event is triggered.
     * It is rejected if/when the singleton's 'error' event is triggered.
     * For a description of the parameters see dx.core.data.getServerSingleton()
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

        model.once("ready", onReadyCallback);
        model.once("error", onErrorCallback);

        // use promise() to lock to deferred, exposing only methods to attach callbacks
        return deferred.promise();
    }

    /*
     * Given a model type, return the name of the "root type". Given DB2Container, OracleContainer, or Container, this
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
            dx.fail("setErrorCallback expects a function as an argument.");
        }
        errorCallback = func;
    }

    /*
     * Reports an ErrorResult model to the end user in the best fashion available at this time.
     */
    function reportErrorResult(errorResult) {
        if (!(errorResult instanceof Backbone.Model) || errorResult.get("type") !== "ErrorResult") {
            dx.fail("reportErrorResult expects an ErrorResult model as an argument.");
        }

        // errorCallback is set by an external source using setErrorCallback
        if (errorCallback) {
            errorCallback(errorResult);
        }

        dx.warn("Error result: " + JSON.stringify(errorResult.toJSON()));
    }

    /*
     * Start the real work here. Initialize everything "below" us.
     */
    context = context || this;
    var parsedSchemas = dx.core.data._prepareSchemas(schemas, queryParamAnnotations);
    var enums = dx.core.data._prepareEnums(parsedSchemas);
    dx.core.data._initCache(context);
    dx.core.data._initFilters(context);
    dx.core.data._generateModelConstructors(parsedSchemas, context);
    dx.core.data._generateCollectionConstructors(parsedSchemas, context);
    dx.core.data._setupNotification(context);

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

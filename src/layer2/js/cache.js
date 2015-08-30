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

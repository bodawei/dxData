#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

#
# Copyright (c) 2014 by Delphix. All rights reserved.
#

from types import *
from string import upper
import threading

class SimpleStorage():
    """
    A simple interface to a storage system.  You might imageine that behind this
    would be a database of some sort.  However for ease of setting up and using
    this demo app, we just store the objects in dictionaries.
    """
    
    lock = threading.Lock()
    
    # a dictionary of dictionaries, where each sub-dictionary is keyed by the
    # rooted type of the objects that may be stored in it
    collections = {}

    # A list of unique id's for each type.
    nextUniqueInt = {}
    
    # object to notify when we've created, updated or deleted an object
    notificationSystem = None
    
    # cached value of a function to give us the right type
    _rootedTypeForType = None


    def __init__(self, rootedTypeForType, notificationSystem):
        self.notificationSystem = notificationSystem;
        self._rootedTypeForType = rootedTypeForType  # function to look up the rooted type for a type


    def _getCollection(self, rootedTypeName):
        """ Get a specific collection """
        if type(rootedTypeName) is not StringType:
            raise Exception('rootedTypeName parameter must be a string')

        if rootedTypeName not in self.collections:
            self.collections[rootedTypeName] = {}

        return self.collections[rootedTypeName]


    def getAll(self, rootedTypeName):
        """
        Returns a list of all objects of the specified type. Note that the type
        must be a rooted type, and that the returned list may be empty
        Raises exception if parameters are bad
        """
        if type(rootedTypeName) is not StringType:
            raise Exception('rootedTypeName parameter must be a string')

        self.lock.acquire()
        if rootedTypeName not in self.collections:
            collection = {}
        else:
            collection = self.collections[rootedTypeName];

        results = []

        for key in collection:
            results.append(collection[key])
        self.lock.release()
        
        return results


    def get(self, rootedTypeName, reference):
        """
        Returns an objct of type typeName with reference reference, or None
        The type name must be a rooted type
        Raises exception if parameters are bad
        """
        if type(rootedTypeName) is not StringType:
            raise Exception('rootedTypeName parameter must be a string.')
        if type(reference) is not StringType:
            raise Exception('reference parameter must be a string.')
                        
        self.lock.acquire()
        collection = self._getCollection(rootedTypeName)
        if reference in collection:
            result = collection[reference]
        else:
            result = None
        self.lock.release()

        return result


    def add(self, obj):
        """
        Adds the specified object to the storage system
        The type name must be a rooted type
        Raises exception if parameters are bad
        """
        if type(obj) is not InstanceType:
            raise Exception('obj must be an instantiated object.')
        if not hasattr(obj, 'reference'):
            raise Exception('Can not store an object that has no reference attribute.')
        if obj.reference is not None:
            raise Exception('Can not add an object that already has a reference.')

        rootedTypeName = self._rootedTypeForType(obj.type);

        self.lock.acquire()
        if rootedTypeName not in self.nextUniqueInt:
            self.nextUniqueInt[rootedTypeName] = 0
        
        newReference = upper(rootedTypeName) + '-' + str(self.nextUniqueInt[rootedTypeName])
        self.nextUniqueInt[rootedTypeName] = self.nextUniqueInt[rootedTypeName] + 1
        obj.reference = newReference
        
        collection = self._getCollection(rootedTypeName)
        collection[newReference] = obj

        self.notificationSystem.create(rootedTypeName, newReference)
        self.lock.release()

        return obj

    def update(self, obj):
        """ Updates an object with the same reference and type as the one passed in """
        if type(obj) is not InstanceType:
            raise Exception('obj must be an instantiated object.')
        if not hasattr(obj, 'reference'):
            raise Exception('Can not update an object that has no reference attribute.')
        if obj.reference is None:
            raise Exception('Can not update an object if the new copy has no reference value.')

        rootedTypeName = self._rootedTypeForType(obj.type);

        self.lock.acquire()
        collection = self._getCollection(rootedTypeName)
        collection[obj.reference] = obj

        self.notificationSystem.update(rootedTypeName, obj.reference)
        self.lock.release()

        return obj
                            
    def delete(self, rootedTypeName, reference):
        """ Deletes the specified object """
        if type(rootedTypeName) is not StringType:
            raise Exception('typeName parameter must be a string.')
        if type(reference) is not StringType:
            raise Exception('reference parameter must be a string.')

        self.lock.acquire()
        collection = self._getCollection(rootedTypeName)
        result = collection.pop(reference, None)

        if result is not None:
            self.notificationSystem.delete(rootedTypeName, reference)
        self.lock.release()


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

from schemaTypes import rootedTypeMapping
from schemaTypes import rootMapping
from returnValues import makeOKResult
from returnValues import makeListResult
from returnValues import makeBadUrl
from returnValues import makeBadMethod
import string
import importlib
import re

def doSchemaObjectOperation(context, path, httpMode, payload):
    """ do something """

    for key in rootMapping.keys():
        result = re.search('^' + key + '(/([^/]+))?(/([^/]+))?$', path)
        if result is not None:
            return processRequest(context, rootMapping[key], httpMode, payload, result.group(2), result.group(4))

    return makeBadUrl()


def isReference(reference):
    index = reference.find('-')
    return not index is -1

def rootedTypeForType(typeName):
    """ Return the root type name given the specified name"""
    return  rootedTypeMapping[str(typeName)]


def processRequest(context, details, httpMode, payload, reference, operation):
    if reference is None:
        if httpMode is 'GET':
            return doList(context, details)
        elif httpMode is 'POST':
            return doCreate(context, details, payload);
        else:
            return makeBadMethod()
    elif operation is not None:
        return doObjectOperation(context, details, reference, operation, payload);
    elif not isReference(reference):
        index = reference.find('?')
        if index is not -1:
            reference = reference[:index]
        print("Calling root operation " + reference)
        return doRootOperation(context, details, reference, payload) # really in this case reference is an operation name
    else:
        if httpMode is 'GET':
            return doRead(context, details, reference);
        elif httpMode is 'POST':
            return doUpdate(context, details, reference, payload);
        elif httpMode is 'context':
            return doDelete(storage, details, reference, payload);
        else:
            return badMethod()

def makeObject(jsonData):
    module = importlib.import_module('schemaTypes.' + jsonData['type'])
    instance = getattr(module, jsonData['type'])()
    instance.fromJson(jsonData)
    return instance

def doList(context, details):
    """ """
    results = context['storage'].getAll(details['name'])
    return makeListResult(results)

def doCreate(context, details, payload):
    """ """
    obj = makeObject(payload)           # needed
    result = context['storage'].add(obj);
    return makeOKResult(result.reference)

def doRead(context, details, reference):
    """ """
    obj = context['storage'].get(details['name'], reference)
    return makeOKResult(obj)

def doUpdate(context, details, reference, payload):
    """ """
    obj = context['storage'].get(details['name'], reference)
    obj.fromJson(payload)
    context['storage'].update(obj)
    return makeOKResult(None)

def doDelete(context, details, reference, payload):
    """ """
    context['storage'].delete(details['name'], reference)
    return makeOKResult(None)

def doObjectOperation(context, details, reference, operation, payload):
    """ """
    obj = context['storage'].get(details['name'], reference);
    try:
        func = getattr(obj, operation)
        func = getattr(klass, operation)
        if payload is not None:
            param = makeObject(payload)
        else:
            param = None
        result = func(context, param)
        return makeOKResult(result);
    except AttributeError:
        return makeBadUrl()

def doRootOperation(context, details, operation, payload):
    """ """
    try:
        klass = details['klass'];
        func = getattr(klass, operation)
        if payload is not None:
            param = makeObject(payload)
        else:
            param = None
        result = func(context, param)
        return makeOKResult(result);
    except AttributeError:
        return BadURL()



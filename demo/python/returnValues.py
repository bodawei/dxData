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

from schemaTypes import OKResult
from schemaTypes import ErrorResult
from schemaTypes import ListResult

def makeReturnObj(code, obj):
    return {
        'code': code,
        'obj': obj
    }

def makeNotAuthorized():
    return makeReturnObj(403, None)

def makeBadUrl():
    return makeReturnObj(404, None)

def makeBadMethod():
    return makeReturnObj(405, None)

def makeInternalServer():
    return makeReturnObj(500, None)

def makeListResult(listOfData):
    result = ListResult()
    result.status = 'OK'
    result.result = listOfData
    return makeReturnObj(200, result)

def makeOKResult(obj):
    result = OKResult()
    result.status = 'OK'
    result.result = obj
    return makeReturnObj(200, result)

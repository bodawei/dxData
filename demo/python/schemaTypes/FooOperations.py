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

from TypedObject import TypedObject

class FooOperations(TypedObject):
    """ Your implemenation of operations for the Foo type."""

    def opWithPayload(self, payload):
        """ 
        An operation with a payload and a really long description which we want
        to have wrapped around a lot
        """
        print("opWithPayload was called")

    def opWithoutAnything(self, ):
        """ 
        A boring operation with nothing
        """

    def opWithoutPayload(self, ):
        """ 
        A boring operation with no payload, really
        """

    def opWithoutParameters(self, ):
        """ 
        A boring operation with no parameters, really
        """

    def opWithParameters(self, parameters):
        """ 
        An operation with a parameters
        """

    @staticmethod
    def rootOpWithParameters(parameters):
        """ 
        An operation with a parameters
        """

    @staticmethod
    def rootOpWithPayload(payload):
        """ 
        An operation with a payload and a really long description which we want
        to have wrapped around a lot
        """
        print("rootOpWithPayload was called")


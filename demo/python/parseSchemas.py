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

import os
import json
import os.path
import string
import sys

#
# This is a simple dxData JSON Schema converter.  Given a directory of
# dxData JSON Schemas (schema, in the current directory), this generates a
# Python class (in schemaTypes) for each dxData schema.
#
# This does only a simple conversion. For instance, it does nothing to assure
# that the resulting Python class instances always have data of the right type.
#
# If a type has operations or root operations, it is assumed that these will
# need to be hand-written.  Thus, if a given type, Foo, has operations or root
# operations, this will generate two types: a type called FooOperations, and
# a subtype called Foo which just has the properties.  Foo will always be
# regenerated, but FooOperations will only be created if there is not already a
# FooOperations in the schemaTypes directory.  This simple scheme allows the
# auto-generated code to be auto-generated, while not affecting any custom code.
#

# Name of the directory where schemas to be written to
TYPE_DIR = sys.argv[len(sys.argv)-1]
# SCHEMA_FILES = sys.argv[1:len(sys.argv)-1]


# Write a description string.  Wrap over multiple lines if needed.
def writeDescription(description, prefix, file):
    linelength = 80 - len(prefix)
    while len(description) > linelength:
        rightIndex = string.rfind(description, " ", 0, linelength)
        if rightIndex is -1:
            rightIndex = linelength
        file.write(prefix + description[:rightIndex] + '\n')
        description = description[rightIndex + 1:]
    file.write(prefix + description + '\n')

# return the supertype name
def getSuperTypeName(schemaDict, allSchemas):
    if 'extends' in schemaDict:
        superSchema = allSchemas[schemaDict['extends']['$ref']]
        return superSchema['name']
    else:
        return None

def getSuperTypeRef(schemaDict, allSchemas):
    if 'extends' in schemaDict:
        superSchemaRef = schemaDict['extends']['$ref']
        return superSchemaRef
    else:
        return None

# write the import and class declartion
def writeClassHeader(file, typeName, superName):
    if superName is None:
        file.write('class ' + typeName + '():\n')
    else:
        file.write('from ' + superName + ' import ' + superName + '\n')
        file.write('\n')
        file.write('class ' + typeName + '(' + superName + '):\n')

def writeProperties(file, schemaDict, allSchemas):
    superTypeRef = getSuperTypeRef(schemaDict, allSchemas)
    if superTypeRef is not None:
        writeProperties(file, allSchemas[superTypeRef], allSchemas)
    
    if 'properties' in schemaDict:
        for propName in schemaDict['properties']:
            propDef = schemaDict['properties'][propName]
            
            defaultValue = 'None'
            if 'default' in propDef:
                defaultValue = str(propDef['default'])
                if defaultValue is 'null':
                    defaultValue = 'None'
        
            file.write('\n')
            if 'description' in propDef:
                writeDescription(propDef['description'], '    # ', file)

            file.write('    ' + propName + ' = ' + defaultValue + '\n')

def writeOperations(file, schemaDict, opProp, isStatic):
    if opProp in schemaDict:
        for opName in schemaDict[opProp]:
            opDef = schemaDict[opProp][opName]

            if isStatic:
                file.write('    @staticmethod\n')

            # write the function declaration. Include a parameters or payload
            # argument if the operation takes such
            file.write('    def ' + opName + '(')
            if not isStatic:
                file.write('self, ')
            
            if 'payload' in opDef:
                if len(opDef['payload'].keys()) > 0:
                    file.write('payload')
            elif 'parameters' in opDef:
                if len(opDef['parameters'].keys()) > 0:
                    file.write('parameters')
            file.write('):\n')

            # write the docsstring for the function
            if 'description' in opDef:
                file.write('        """ \n')
                writeDescription(opDef['description'], '        ', file)
                file.write('        """')
            file.write('\n')
            file.write('\n')

# given a type which has operations, write out a skeleton which can be hand-augmented
def makeOperationSuperType(schemaDict, allSchemas):
    # create the output file, overwriting if it already exists
    typeName = schemaDict['name'] + 'Operations'
    superName = getSuperTypeName(schemaDict, allSchemas)

    pathName = os.path.join(TYPE_DIR, typeName + '.py');
    if not os.path.exists(pathName):
        file = open(pathName, 'w')
        writeClassHeader(file, typeName, superName)
        file.write('    """ Your implemenation of operations for the ' + schemaDict['name']  + ' type."""\n')
        file.write('\n')

        writeOperations(file, schemaDict, 'operations', False)
        writeOperations(file, schemaDict, 'rootOperations', True)

        file.close();
    return typeName

# Add a toJson method.
# Thanks to stackoverflow here http://stackoverflow.com/questions/11637293/iterate-over-object-attributes-in-python
def writeToJson(file):
    file.write("\n")
    file.write("    def _handleObject(self, obj):\n")
    file.write('        """ Handler for when JSON writing encounters an object. """\n')
    file.write("\n")
    file.write("        if getattr(obj, 'toJson'):\n")
    file.write("           result = {}\n")
    file.write("           attrNames = [attr for attr in dir(obj) if not attr.startswith('__') and not callable(getattr(obj,attr))]\n")
    file.write("           for name in attrNames:\n")
    file.write("              result[name] = getattr(obj, name)\n")
    file.write("           return result\n")
    file.write("        else:\n")
    file.write("            raise TypeError()\n")
    file.write("\n")
    file.write("    def toJson(self):\n")
    file.write('        """ Write the data attributes of this type to JSON format"""\n')
    file.write("\n")
    file.write("        selfAsDict = self._handleObject(self)\n")
    file.write("        return json.dumps(selfAsDict, default=self._handleObject)\n")
    file.write("\n")

def writeFromJson(file):
    file.write("\n")
    file.write("    def fromJson(self, jsonData):\n")
    file.write('        """ set the properties of this object from the json blob. silently ignore irrelevant props. (bad, bad!)"""\n')
    file.write("\n")
    file.write("        for key in jsonData:\n")
    file.write("           if hasattr(self, key):\n")
    file.write("              setattr(self, key, jsonData[key])\n")
    file.write("\n")

def writeInit(file, typeName):
    file.write('\n')
    file.write('    def __init__(self):\n')
    file.write('       """ initialize the instance """\n')
    file.write('       self.type = \"' + typeName + '\"\n')


# Given a schema, create a python class for it
def makePythonType(schemaDict, allSchemas):
    superName = None
    types = []
    
    # Deal with inheritance
    if 'operations' in schemaDict or 'rootOperations' in schemaDict:
        superName = makeOperationSuperType(schemaDict, allSchemas)
        types.append(superName)
    else:
        superName = getSuperTypeName(schemaDict, allSchemas)

    # create the output file, overwriting if it already exists
    typeName = schemaDict['name']
    types.append(typeName)
    file = open(os.path.join(TYPE_DIR, typeName + '.py'), 'w')

    if superName is None:
        file.write('import json\n\n')

    writeClassHeader(file, typeName, superName)

    # Generate the docstring
    if 'description' in schemaDict:
        file.write('    """ \n')
        writeDescription(schemaDict['description'], '    ', file)
        file.write('    Auto-generated class from JSON Schema definition\n')
        file.write('    """')
    else:
        file.write('    """ Auto-generated class from JSON Schema definition """\n')
    file.write('\n')

    writeInit(file, typeName)

    # write out each property, and assign a default value if any
    writeProperties(file, schemaDict, allSchemas)

    if superName is None:
        writeToJson(file)
        writeFromJson(file)

    file.write('\n')
    file.close()
    return types


# Create the output directory if it doesn't already exist
if not os.path.exists(TYPE_DIR):
    os.mkdir(TYPE_DIR)

# read in all schemas
allJsonSchemas = {}
for root, dirs, files in os.walk('../schema'):
    for fileName in files:
        if fileName.endswith(".json"):
            file = open(root + '/' + fileName, 'r')
            jsonData = json.load(file)
            file.close()
            allJsonSchemas['/' + fileName] = jsonData
for root, dirs, files in os.walk('schema'):
    for fileName in files:
        if fileName.endswith(".json"):
            file = open(root + '/' + fileName, 'r')
            jsonData = json.load(file)
            file.close()
            allJsonSchemas['/' + fileName] = jsonData


# Convert all schemas to Python types
allTypes = []
for schemaName in allJsonSchemas:
    types = makePythonType(allJsonSchemas[schemaName], allJsonSchemas)
    for type in types:
        allTypes.append(type)

#
# Write out the package file
#
file = open(os.path.join(TYPE_DIR, '__init__.py'), 'w')
allTypes.sort()

# Write __all__
file.write("__all__ = ['" + "', '".join(allTypes) + "']\n")
file.write('\n')

# import all the classes
for type in allTypes:
    file.write('from ' + type + ' import ' + type + '\n')
file.write('\n')

# write out rootedTypeMapping
file.write('rootedTypeMapping = {\n')
lines = []
for schemaRef in allJsonSchemas:
    root = None
    currentRef = schemaRef
    currentDict = allJsonSchemas[currentRef]
    if 'root' in currentDict:
        root = currentDict['root']
    while root is None and currentRef is not None:
        currentRef = getSuperTypeRef(allJsonSchemas[currentRef], allJsonSchemas)
        if currentRef is not None:
            currentDict = allJsonSchemas[currentRef]
            if 'root' in currentDict:
                root = currentDict['root']
    line = "    '" + allJsonSchemas[schemaRef]['name'] + "' : "
    if currentRef is None:
        line += 'None'
    else:
        line += "'" + currentDict['name'] + "'"
    lines.append(line);
lines.sort();
file.write(',\n'.join(lines) + '\n}\n')
file.write('\n')

# Write the root URL mapping
file.write('rootMapping = {\n')
lines = []
for schemaRef in allJsonSchemas:
    dict = allJsonSchemas[schemaRef]
    if 'root' in dict:
        line = "    '" + dict['root'] + "' : {\n"
        line += "        'name': '" + dict['name'] + "',\n"
        line += "        'klass': " + dict['name'] + ",\n"
        line += "    }"
        lines.append(line)
lines.sort();
file.write(',\n'.join(lines) + '\n}\n')
file.write('\n')

const codegen = require('postman-code-generators'),
  sdk = require('postman-collection');

/**
 * sanitizes input string by handling escape characters eg: converts '''' to '\'\''
 *
 * @param {String} inputString
 * @returns {String}
 */
function sanitize (inputString) {
  if (typeof inputString !== 'string') {
    return '';
  }
  return inputString.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/\n/g, '\\n');
}

/**
 * Replaces postman variables( {{variable}} ) in the generated snippet as
 * `' + variable_name + '`
 *
 * @param {String} requestSnippet - Request snipept generated by postman-code-generator
 * @returns {String} - Request snippet string with replaced collection variables
 */
function replaceVariables (requestSnippet) {
  var variableDeclarations = requestSnippet.match(/{{[^{\s\n}]*}}/g);
  if (variableDeclarations !== null) {
    variableDeclarations.forEach((element) => {
      // replacing {{variable_name}} with ' + variable_name + '
      requestSnippet = requestSnippet.replace(element, '\' + ' + element.substring(2, element.length - 2) + ' + \'');
    });
  }
  return requestSnippet;
}

/**
 * Generates snippet for a function declaration

 * @param {String} collectionItem - PostmanItem Instance
 * @param {Object} options - postman-code-gen options (for specific language)
 * @returns {String} - returns a snippet of function declaration of of a request
 */
function generateFunctionSnippet (collectionItem, options) {
  let snippet = '',
    variableDeclarations;
  codegen.convert('NodeJs', 'Request', collectionItem.request, options, function (err, requestSnippet) {
    if (err) {
      throw err;
    }

    variableDeclarations = requestSnippet.match(/{{[^{\s\n}]*}}/g);

    // JSDocs declaration
    snippet += `/**\n${collectionItem.request.description}\n`;
    snippet += '@param {Function} callback - Callback function to return response (err, res)\n';
    variableDeclarations.forEach((element) => {
      let varName = element.substring(2, element.length - 2);
      snippet += `@param {String} variables.${varName}\n`;
    });
    snippet += '*/\n';

    // Function declaration
    snippet += options.ES6_enabled ? '(variables, callback) => {\n' : 'function(variables, callback){\n';

    // Request level variable declaration
    variableDeclarations.forEach((element) => {
      let varName = element.substring(2, element.length - 2);
      snippet += options.ES6_enabled ? 'let ' : 'var ';
      snippet += `${varName} = variables.${varName} ? variables.${varName} : self.environmentVariables.${varName};\n`;
    });

    snippet += replaceVariables(requestSnippet);
    snippet += '}';
  });
  return snippet;
}

/**
 * Extracts requests and generats snipepts collection members
 * Algorithm used : Reccursive dfs function which uses promises to traverse the postman-collection

 * @param {Object} collectionItemMember - PostmanItem or PostmanItemGroup instance
 * @param {Object} options - postman-code-gen options (for specific language)
 * @param {Functionn} callback - Callback function to return response (err, snippet)
 * @returns {Promise} - promise containing snippet for collection requests or error
 * TODO fix issue with indent
 * TODO merge all function related stuff to generateFunctionSnippet method
 */
function processCollection (collectionItemMember, options, callback) {
  var snippet = '';
  if (sdk.Item.isItem(collectionItemMember)) {
    snippet += `"${collectionItemMember.name}": \n`;
    try {
      snippet += generateFunctionSnippet(collectionItemMember, options);
    }
    catch (err) {
      return callback(err, null);
    }
    snippet += ',\n';
    return callback(null, snippet);
  }
  snippet += `/**\n${collectionItemMember.description}\n*/\n`;
  snippet += `"${collectionItemMember.name}": {\n`;
  collectionItemMember.items.members.forEach((element) => {
    processCollection(element, options, (err, snippetr) => {
      if (err) {
        return callback(err, null);
      }
      snippet += snippetr;
    });
  });
  snippet += '},\n';
  return callback(null, snippet);
}

module.exports = {
  generateFunctionSnippet,
  processCollection,
  replaceVariables,
  sanitize
};

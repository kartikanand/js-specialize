// required for manipulating AST
const cherow = require('cherow');
const fs = require('fs');


function isFunction(functionToCheck) {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
}


function writer (fileName, stmt) {
    fs.appendFileSync(fileName, stmt);
    fs.appendFileSync(fileName, '\n');
}


function writePrint (stmt) {
    writer('test.js', "console.log(`" + stmt + "`);");
}


function handleUnaryExpression (unexpAST, staticVars) {
    const arg = unexpAST.argument;
    const operator = unexpAST.operator;

    return operator + ' ' + specialize(arg, staticVars);
}


function handleBinaryExpression (binexpAST, staticVars) {
    const left = binexpAST.left;
    const right = binexpAST.right;
    const operator = binexpAST.operator;

    return specialize(left, staticVars) + ' ' + operator + ' ' + specialize(right, staticVars);
}


function handleVarDeclaration (varDeclAST) {
    const init = varDeclAST.init ? ' = ' + varDeclAST.init : '';
    const name = varDeclAST.id.name;

    return `var ${name} ${init} ;\n`;
}


function handleUpdateExpression (expAST, staticVars) {
    const arg = expAST.argument;
    const operator = expAST.operator;

    if (expAST.prefix) {
        return operator + specialize(arg, staticVars);
    } else {
        return specialize(arg, staticVars) + operator;
    }
}


function handleVarDeclarations (varDeclAST) {
    const declarations = varDeclAST.declarations;

    for (decl of declarations) {
        handleVarDeclaration(decl);
    }
}


function handleConditional (expAST, staticVars) {
    const test = expAST.test;
    const consequent = expAST.consequent;
    const alternate = expAST.alternate;

    return specialize(test, staticVars) + ' ? ' + specialize(consequent, staticVars) + ' : ' + specialize(alternate, staticVars) + ' ;';
}


function handleIfStatement (expAST, staticVars) {
    const test = expAST.test;
    const consequent = expAST.consequent;
    const alternate = expAST.alternate;

    const ifCondition = `if(${specialize(test, staticVars)})`;

    // write if condition test
    writePrint(ifCondition);

    // handle then body
    writePrint('{');
    handleBlockStatement(consequent, staticVars);
    writePrint('}');

    // check if else branch exists
    if (alternate) {
        writePrint('else {');
        handleBlockStatement(alternate, staticVars);
        writePrint('}');
    }

    return '';
}


function handleReturnStatement (expAST, staticVars) {
    const arg = expAST.argument;

    return 'return ' + specialize(arg, staticVars) + ' ;';
}


function handleAssignStmt (assignAST, staticVars) {
    const left = assignAST.left.name;
    const operator = assignAST.operator;
    const right = specialize(assignAST.right, staticVars);

    return `${left} ${operator} ${right}`;
}


function handleForStatement (expAST, staticVars) {
    const body = expAST.body;
    const init = expAST.init;
    const test = expAST.test;
    const update = expAST.update;

    // handle loop block
    handleBlockStatement(body, staticVars);
}


function handleExpressionStmt (expAST, staticVars) {
    if (expAST.expression.type == 'AssignmentExpression') {
        return handleAssignStmt(expAST.expression, staticVars);
    } else if (expAST.expression.type == 'UpdateExpression') {
        return handleUpdateExpression(expAST.expression, staticVars);
    }
}


function handleBlockStatement(expAST, staticVars) {
    const body = expAST.body;
    for (const stmt of body) {
        const specializedStmt = specialize(stmt, staticVars);
        writePrint(specializedStmt);
    }

    return '';
}


function specialize (expAST, staticVars) {
    const type = expAST.type;
    if (type == 'BinaryExpression') {
        return handleBinaryExpression(expAST, staticVars);
    } else if (type == 'BlockStatement') {
        return handleBlockStatement(expAST, staticVars);
    } else if (type == 'IfStatement') {
        return handleIfStatement(expAST, staticVars);
    } else if (type == 'ConditionalExpression') {
        return handleConditional(expAST, staticVars);
    } else if (type == 'UnaryExpression') {
        return handleUnaryExpression(expAST, staticVars);
    } else if (type == 'UpdateExpression') {
        return handleUpdateExpression(expAST, staticVars);
    } else if (type == 'ExpressionStatement') {
        return handleExpressionStmt(expAST, staticVars);
    } else if (type == 'ReturnStatement') {
        return handleReturnStatement(expAST, staticVars);
    } else if (type == 'ForStatement') {
        return handleForStatement(expAST, staticVars);
    } else if (type == 'VariableDeclaration') {
        return handleVarDeclarations(expAST);
    } else if (type == 'Literal') {
        return expAST.value;
    } else if (type == 'Identifier') {
        if (staticVars.includes(expAST.name)) {
            return '${' + `${staticVars}` + '}';
        } else {
            return expAST.name;
        }
    }
}


/*
 * The following function receives a static variable
 * and the function AST. It does binding time on the function
 * and returns a list of corresponding static and dynamic variables
 */
function bindingTimeAnalysis (funcBodyAST, staticVars) {
    // initialize two empty arrays that we'll return
    const staticVarss = [];
    const dynamicVars = [];

    // loop over body statements and mark variables accordingly
    for (const stmt of funcBodyAST.body) {
    }

    // return an object with corresponding keys
    return {
        staticVarss,
        dynamicVars
    };
}

/*
 * The following function is responsible for creating a 
 * specialized version of the passed function with respect
 * to a static variable which should be an argument to
 * the function
 */
function genSpecialized (funcAST, staticVars) {
    const funcName = funcAST.id.name;
    const funcNameGen = funcName + '_gen';
    const funcNameSpecial = funcName + '_special';

    writer('test.js', `function ${funcNameGen} (${staticVars})`);
    writer('test.js', '{');

    writePrint(`function ${funcNameSpecial} (y)`);
    writePrint('{');

    specialize(funcAST.body, staticVars);

    writePrint('}');

    writer('test.js', '}');
}


function getFunctionAST (fileName, funcName) {
    const fileContents = fs.readFileSync(fileName, 'utf8');
    const progAST = cherow.parseScript(fileContents);

    // return the correct function
    for (const funcAST of progAST.body) {
        if (funcAST.id.name == funcName) {
            return funcAST;
        }
    }

    return null;
}


/*
 * The following is the main function which reads arguments
 * from the command line and accordingly outputs a generating
 * extension for the passed function and a static argument
 */
function main () {
    // ignore the first two arguments and get the rest
    const args = process.argv.slice(2);

    // get file name, function name, and argument respectively
    const fileName = args[0];

    // require module so that it could be processed
    const moduleObject = require('./' + fileName);

    // iterate over everything in module object
    Object.keys(moduleObject).forEach(function(key) {
        const val = moduleObject[key];

        // check if we got a function
        if (isFunction(val)) {
            // check if it needs to be specialized
            if (val.specialize) {
                // get function name and static vars
                const funcName = key;
                const staticArg = val.staticVars;

                // get function AST from file
                const funcAST = getFunctionAST(fileName, funcName);

                // generate the specialized version of this function
                genSpecialized(funcAST, staticArg);
            }
        }
    });

}

// just call main
main();


# repl helper
small utility to spawn a repl (lua, node, python) and communicate with it

## example
```
import { createReplExecutor } from 'repl-helper';

async function start() {
    console.log('python');
    let result = await createReplExecutor('/usr/bin/python', ['-u', '-q'], '>>> ');
    console.log(await result.execute('print(5+5)'));
    result.close();

    console.log('lua');
    result = await createReplExecutor('/usr/bin/lua', [], '> ');
    console.log(await result.execute('print(5+5);'));
    result.close();

    console.log('node');
    result = await createReplExecutor('/usr/bin/node', [], '> ');
    console.log(await result.execute('console.log(5+5);'));
    result.close();
}
start();
```
/**
 * Copyright (c) 2020 Mathis Zeiher
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */

import nodepty from 'node-pty';

async function openInteractiveRepl(file: string, args: string[], replIndicator: string) {
    const childprocess = nodepty.spawn(file, args, {
    });
    let resolver = null;
    const promise = new Promise<string>((resolve) => {
        resolver = resolve;
    });
    let buffer: string = '';
    let command: string = '';
    childprocess.on('data', (data) => {
        if (resolver) {
            buffer += data;
            buffer = buffer.replace(/\u001b\[[a-zA-Z0-9]{2,3}/g, '') // remove color coding and command instructions
            if (buffer.endsWith(replIndicator)) {
                let result = buffer.substring(command.length + 1, buffer.length - replIndicator.length).trim();
                resolver(result.trim());
                resolver = null;
            }
        }
    });
    await promise;
    return {
        close() {
            childprocess.kill('SIGTERM');
        },
        async execute(data: string): Promise<string> {
            if (!data.endsWith('\n')) {
                data += '\n';
            }
            buffer = '';
            command = data;
            const promise = new Promise<string>((resolve) => {
                resolver = resolve;
            });
            childprocess.write(data);

            return promise;
        }
    };
}

const createSynchonizedscheduler = () => {
    const executionQueue: { runner: () => Promise<unknown>, callback: (data: string, error?: string) => void }[] = [];
    let schedulerRunning = false;
    const shedule = (runner: () => Promise<unknown>, callback: (data: string, error?: string) => void) => {
        executionQueue.push({ runner, callback });
        if (!schedulerRunning) {
            schedulerRunning = true;
            Promise.resolve().then(async () => {
                let entry: { runner: () => Promise<unknown>, callback: (data: string, error?: string) => void } = undefined;
                while ([entry] = executionQueue.splice(0, 1)) {
                    if (entry === undefined) break;
                    let error = undefined;
                    let response = undefined;
                    try {
                        response = await entry.runner();
                    } catch (e) {
                        error = e
                    }
                    entry.callback(response, error);
                }
                schedulerRunning = false;
            });
        }
    }
    return { shedule, close: () => { executionQueue.splice(0, executionQueue.length) } };
}

export const createReplExecutor = async (file: string, args: string[], replIndicator: string) => {
    const scheduler = createSynchonizedscheduler();
    const repl = await openInteractiveRepl(file, args, replIndicator);
    return {
        execute: async (execute: string): Promise<unknown> => {
            return new Promise((resolve) => {
                scheduler.shedule(async () => {
                    const data = await repl.execute(execute);
                    return data;
                }, (data, error) => {
                    resolve(data);
                });
            });
        }, close: () => { scheduler.close(); repl.close() }
    }
}


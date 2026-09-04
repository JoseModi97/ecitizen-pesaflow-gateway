import * as readline from 'readline';
/**
 * Clean terminal prompter with zero external dependencies.
 * Works seamlessly across Node 16, 18, 20, 22+.
 */
export class CliPrompter {
    rl;
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }
    close() {
        this.rl.close();
    }
    /**
     * Ask a text question with optional default and validation.
     */
    async ask(question) {
        return new Promise((resolve) => {
            const defaultStr = question.default ? ` \x1b[90m(${question.default})\x1b[0m` : '';
            const promptText = `\x1b[36m?\x1b[0m \x1b[1m${question.message}\x1b[0m${defaultStr}: `;
            const promptOnce = () => {
                this.rl.question(promptText, (answer) => {
                    let value = answer.trim();
                    if (value === '' && question.default !== undefined) {
                        value = question.default;
                    }
                    if (question.validate) {
                        const validation = question.validate(value);
                        if (validation !== true) {
                            const errMsg = typeof validation === 'string' ? validation : 'Invalid input.';
                            console.log(`  \x1b[31m>> ${errMsg}\x1b[0m`);
                            return promptOnce();
                        }
                    }
                    resolve(value);
                });
            };
            promptOnce();
        });
    }
    /**
     * Ask a question requiring secret/password input.
     */
    async askSecret(question) {
        return new Promise((resolve) => {
            const defaultStr = question.default ? ` \x1b[90m(hidden default)\x1b[0m` : '';
            const promptText = `\x1b[36m?\x1b[0m \x1b[1m${question.message}\x1b[0m${defaultStr}: `;
            // In environments where raw mode is available, mask output
            if (process.stdin.isTTY) {
                process.stdout.write(promptText);
                let input = '';
                const onData = (char) => {
                    const str = char.toString('utf8');
                    if (str === '\r' || str === '\n' || str === '\u0004') {
                        process.stdin.removeListener('data', onData);
                        if (process.stdin.setRawMode) {
                            process.stdin.setRawMode(false);
                        }
                        process.stdout.write('\n');
                        let val = input.trim();
                        if (val === '' && question.default !== undefined) {
                            val = question.default;
                        }
                        if (question.validate) {
                            const res = question.validate(val);
                            if (res !== true) {
                                console.log(`  \x1b[31m>> ${typeof res === 'string' ? res : 'Invalid input.'}\x1b[0m`);
                                return this.askSecret(question).then(resolve);
                            }
                        }
                        resolve(val);
                    }
                    else if (str === '\u0003') {
                        // Ctrl+C
                        process.exit(130);
                    }
                    else if (str === '\b' || str === '\x7f') {
                        if (input.length > 0) {
                            input = input.slice(0, -1);
                            process.stdout.write('\b \b');
                        }
                    }
                    else {
                        input += str;
                        process.stdout.write('*');
                    }
                };
                if (process.stdin.setRawMode) {
                    process.stdin.setRawMode(true);
                }
                process.stdin.resume();
                process.stdin.on('data', onData);
            }
            else {
                // Fallback for non-TTY
                this.ask(question).then(resolve);
            }
        });
    }
    /**
     * Ask user to select from a list of choices.
     */
    async select(question) {
        console.log(`\n\x1b[36m?\x1b[0m \x1b[1m${question.message}\x1b[0m`);
        question.choices.forEach((choice, idx) => {
            const isDefault = idx === (question.defaultIndex ?? 0);
            const marker = isDefault ? '\x1b[32m>\x1b[0m' : ' ';
            console.log(`  ${marker} \x1b[33m${idx + 1})\x1b[0m ${choice.label}`);
        });
        const defaultIndex = question.defaultIndex ?? 0;
        const defaultVal = String(defaultIndex + 1);
        const answer = await this.ask({
            name: question.name,
            message: `Enter choice [1-${question.choices.length}]`,
            default: defaultVal,
            validate: (val) => {
                const num = parseInt(val, 10);
                if (isNaN(num) || num < 1 || num > question.choices.length) {
                    return `Please enter a number between 1 and ${question.choices.length}.`;
                }
                return true;
            },
        });
        const selectedIndex = parseInt(answer, 10) - 1;
        return question.choices[selectedIndex].value;
    }
    /**
     * Ask a yes/no confirmation.
     */
    async confirm(message, defaultYes = true) {
        const hint = defaultYes ? 'Y/n' : 'y/N';
        const answer = await this.ask({
            name: 'confirm',
            message: `${message} \x1b[90m(${hint})\x1b[0m`,
            default: defaultYes ? 'y' : 'n',
        });
        const clean = answer.trim().toLowerCase();
        if (clean === 'y' || clean === 'yes')
            return true;
        if (clean === 'n' || clean === 'no')
            return false;
        return defaultYes;
    }
}

export interface PromptQuestion {
    name: string;
    message: string;
    default?: string;
    secret?: boolean;
    validate?: (value: string) => boolean | string;
}
export interface ChoiceQuestion {
    name: string;
    message: string;
    choices: Array<{
        label: string;
        value: string;
    }>;
    defaultIndex?: number;
}
/**
 * Clean terminal prompter with zero external dependencies.
 * Works seamlessly across Node 16, 18, 20, 22+.
 */
export declare class CliPrompter {
    private rl;
    constructor();
    close(): void;
    /**
     * Ask a text question with optional default and validation.
     */
    ask(question: PromptQuestion): Promise<string>;
    /**
     * Ask a question requiring secret/password input.
     */
    askSecret(question: PromptQuestion): Promise<string>;
    /**
     * Ask user to select from a list of choices.
     */
    select(question: ChoiceQuestion): Promise<string>;
    /**
     * Ask a yes/no confirmation.
     */
    confirm(message: string, defaultYes?: boolean): Promise<boolean>;
}

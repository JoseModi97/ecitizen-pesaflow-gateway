export interface SetupAnswers {
    apiClientID: string;
    apiKey: string;
    secret: string;
    serviceID: string;
    gatewayUrl: string;
    currency: string;
    framework: 'express' | 'fastify' | 'next-app' | 'next-pages' | 'nest' | 'standalone';
    targetDir: string;
    isTypeScript: boolean;
    isEsm: boolean;
}
export declare class ProjectScaffolder {
    static detectProjectEnvironment(targetDir: string): {
        isTypeScript: boolean;
        isEsm: boolean;
        detectedFramework?: SetupAnswers['framework'];
    };
    static updateEnvFile(targetDir: string, answers: SetupAnswers): string;
    static createConfigFile(targetDir: string, answers: SetupAnswers): string;
    static scaffoldController(targetDir: string, answers: SetupAnswers): string[];
}

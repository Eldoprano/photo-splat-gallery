declare module '@mkkellogg/gaussian-splats-3d' {
    export class Viewer {
        constructor(options?: {
            cameraUp?: [number, number, number];
            initialCameraPosition?: [number, number, number];
            initialCameraLookAt?: [number, number, number];
            rootElement?: HTMLElement;
            sharedMemoryForWorkers?: boolean;
        });

        addSplatScene(url: string, options?: {
            splatAlphaRemovalThreshold?: number;
            showLoadingUI?: boolean;
            progressiveLoad?: boolean;
            format?: number;
        }): Promise<void>;

        start(): void;
        dispose(): void;

        camera?: {
            position: { x: number; y: number; z: number };
        };
        controls?: {
            target: { x: number; y: number; z: number };
        };
    }
}

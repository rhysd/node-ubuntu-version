import { execFile } from 'child_process';

export interface UbuntuVersion {
    readonly description: string;
    readonly release: string;
    readonly codename: string;
    readonly version: number[];
}

class LsbReleaseOutput implements UbuntuVersion {
    constructor(public description: string, public release: string, public codename: string) {}

    get version(): number[] {
        const re = /(\d+)\.(\d+)(?:\.(\d+))?/;
        for (const s of [this.description, this.release]) {
            const m = s.match(re);
            if (m !== null) {
                const ss = [m[1], m[2]];
                if (m[3]) {
                    ss.push(m[3]);
                }
                return ss.map(s => parseInt(s, 10));
            }
        }
        return [];
    }
}

function isSystemError(e: Error): e is NodeJS.ErrnoException {
    return 'errno' in e;
}

function command(exe: string, args: string[]): Promise<string | null> {
    return new Promise((resolve, reject) => {
        execFile(exe, args, { encoding: 'utf8', shell: false }, (error, stdout, stderr) => {
            if (error) {
                if (isSystemError(error) && error.code === 'ENOENT') {
                    resolve(null); // When lsb_release is not found
                    return;
                }
                reject(new Error(`Could not execute \`${exe} ${args.join(' ')}\`: ${error} (stderr=${stderr})`));
                return;
            }
            resolve(stdout);
        });
    });
}

export async function getUbuntuVersion(): Promise<UbuntuVersion | null> {
    if (process.platform !== 'linux') {
        return null;
    }

    const stdout = await command('lsb_release', ['-a']);
    if (stdout === null) {
        return null;
    }

    const reDistributor = /^Distributor ID:\s*(.+)$/;
    const reDescription = /^Description:\s*(.+)$/;
    const reRelease = /^Release:\s*(.+)$/;
    const reCodename = /^Codename:\s*(.+)$/;
    let description = null;
    let release = null;
    let codename = null;
    let distributorFound = false;
    for (const line of stdout.split('\n')) {
        const m = line.match(reDistributor);
        if (m !== null) {
            const distributor = m[1];
            if (distributor !== 'Ubuntu') {
                return null;
            }
            distributorFound = true;
        }

        const desc = line.match(reDescription)?.[1];
        if (desc) {
            description = desc;
        }
        const rel = line.match(reRelease)?.[1];
        if (rel) {
            release = rel;
        }
        const code = line.match(reCodename)?.[1];
        if (code) {
            codename = code;
        }
    }

    if (!distributorFound || description === null || release === null || codename === null) {
        return null;
    }

    return new LsbReleaseOutput(description, release, codename);
}

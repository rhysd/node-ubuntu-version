import { exec } from 'child_process';

export interface UbuntuVersion {
    description: string;
    release: string;
    codename: string;
}

export async function getUbuntuVersion(): Promise<UbuntuVersion | null> {
    function command(cmd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            exec(cmd, { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Could not execute ${cmd}: ${error} (stderr=${stderr})`));
                    return;
                }
                resolve(stdout);
            });
        });
    }

    if (process.platform !== 'linux') {
        return null;
    }

    const stdout = await command('lsb_release -a');
    const reDistributor = /^Distributor ID:\s*(.+)$/;
    const reDescription = /^Description:\s*(.+)$/;
    const reRelease = /^Release:\s*(.+)$/;
    const reCodename = /^Codename:\s*(.+)$/;
    let description = undefined;
    let release = undefined;
    let codename = undefined;
    for (const line of stdout.split('\n')) {
        const m = line.match(reDistributor);
        if (m !== null) {
            const distributor = m[1];
            if (distributor !== 'Ubuntu') {
                return null;
            }
        }

        description = line.match(reDescription)?.[1];
        release = line.match(reRelease)?.[1];
        codename = line.match(reCodename)?.[1];
    }

    if (!description || !release || !codename) {
        return null;
    }

    return { description, release, codename };
}

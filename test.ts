import { strict as A } from 'assert';
import mock = require('mock-require');
import { getUbuntuVersion } from '.';

class ExecFileMock {
    called: any[] | null;
    getUbuntuVersion: () => Promise<number[]>;

    constructor(public output: string | Error) {
        this.called = null;

        const execFile = (...args: any[]): void => {
            this.called = args;
            const cb = args[args.length - 1];
            if (typeof this.output === 'string') {
                cb(null, this.output, '');
            } else {
                cb(this.output, '', 'error test');
            }
        };
        mock('child_process', { execFile });
        this.getUbuntuVersion = mock.reRequire('.').getUbuntuVersion;
    }

    static finalize(): void {
        mock.stop('child_process');
    }
}

describe('getUbuntuVersion()', function () {
    const savedPlatform = process.platform;

    context('on Ubuntu', function () {
        before(function () {
            Object.defineProperty(process, 'platform', { value: 'linux' });
        });

        after(function () {
            Object.defineProperty(process, 'platform', { value: savedPlatform });
            ExecFileMock.finalize();
        });

        it('parses Ubuntu 20.04 lsb_release output', async function () {
            const output = [
                'No LSB modules are available.',
                'Distributor ID:	Ubuntu',
                'Description:	Ubuntu 20.04.2 LTS',
                'Release:	20.04',
                'Codename:	focal',
            ].join('\n');
            const mocked = new ExecFileMock(output);
            const ver = await mocked.getUbuntuVersion();
            A.deepEqual(ver, [20, 4, 2]);
            A.ok(mocked.called);
            A.equal(mocked.called[0], 'lsb_release');
        });

        it('parses Ubuntu 20.10 lsb_release output', async function () {
            const output = [
                'No LSB modules are available.',
                'Distributor ID:	Ubuntu',
                'Description:	Ubuntu 20.10.1',
                'Release:	20.10',
                'Codename:	groovy',
            ].join('\n');
            const mocked = new ExecFileMock(output);
            const ver = await mocked.getUbuntuVersion();
            A.deepEqual(ver, [20, 10, 1]);
        });

        it('returns empty array with no distributor ID', async function () {
            const output = ['No LSB modules are available.'].join('\n');
            const mocked = new ExecFileMock(output);
            const ver = await mocked.getUbuntuVersion();
            A.deepEqual(ver, []);
        });

        it('returns empty array when lsb_release is not found', async function () {
            // Pseudo SystemError since no constructor is public for the class
            const err = Object.assign(new Error(''), { errno: -2, code: 'ENOENT' });
            const mocked = new ExecFileMock(err);
            const ver = await mocked.getUbuntuVersion();
            A.deepEqual(ver, []);
        });

        it('returns empty array on Linux other than Ubuntu', async function () {
            const output = [
                'LSB Version:	:base-4.0-ia32:base-4.0-noarch:core-4.0-ia32:core-4.0-noarch',
                'Distributor ID:	CentOS',
                'Description:	CentOS release 6.7 (Final)',
                'Release:	6.7',
                'Codename:	Final',
            ].join('\n');
            const mocked = new ExecFileMock(output);
            const ver = await mocked.getUbuntuVersion();
            A.deepEqual(ver, []);
        });

        it('throws an error when lsb_release command fails', async function () {
            const err = new Error('this is error message');
            const mocked = new ExecFileMock(err);
            await A.rejects(
                async () => {
                    await mocked.getUbuntuVersion();
                },
                err => {
                    A.ok(err.message.startsWith('Could not execute'));
                    A.ok(err.message.includes('this is error message'));
                    A.ok(err.message.includes('error test'));
                    return true;
                },
            );
        });

        it('returns empty array when no version is detected', async function () {
            const output = [
                'Distributor ID:	Ubuntu',
                'Description:	Ubuntu a.b.c LTS',
                'Release:	a.b',
                'Codename:	...',
            ].join('\n');
            const mocked = new ExecFileMock(output);
            const ver = await mocked.getUbuntuVersion();
            A.deepEqual(ver, []);
        });

        it('gets version from release when description is useless', async function () {
            const output = [
                'No LSB modules are available.',
                'Distributor ID:	Ubuntu',
                'Description:	Ubuntu ... LTS',
                'Release:	20.04',
                'Codename:	focal',
            ].join('\n');
            const mocked = new ExecFileMock(output);
            const ver = await mocked.getUbuntuVersion();
            A.deepEqual(ver, [20, 4]);
        });
    });

    context('on non-Linux OSes', function () {
        after(function () {
            Object.defineProperty(process, 'platform', { value: savedPlatform });
        });

        for (const platform of ['darwin', 'windows']) {
            it(`returns empty array on ${platform}`, async function () {
                Object.defineProperty(process, 'platform', { value: platform });
                const ver = await getUbuntuVersion();
                A.deepEqual(ver, []);
            });
        }
    });

    // More tests on CI for integration between system and this library
    const osName = process.env['TEST_CI_OS_NAME'];
    if (osName?.startsWith('ubuntu-')) {
        it(`returns proper version info for '${osName}' on CI`, async function () {
            const [major, minor] = ((): [number, number] => {
                const ver = osName.slice('ubuntu-'.length);
                switch (ver) {
                    case 'latest':
                    case '20.04':
                        return [20, 4];
                    case '18.04':
                        return [18, 4];
                    case '16.04':
                        return [16, 4];
                    default:
                        throw new Error(`Unexpected OS: ${osName}`);
                }
            })();

            const ver = await getUbuntuVersion();
            A.ok(ver.length >= 2);
            A.equal(ver[0], major);
            A.equal(ver[1], minor);
        });
    }
});

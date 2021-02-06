import { strict as A } from 'assert';
import mock = require('mock-require');
import { getUbuntuVersion, UbuntuVersion } from '.';

class ExecFileMock {
    called: any[] | null;
    getUbuntuVersion: () => Promise<UbuntuVersion | null>;

    constructor(public output: string | Error) {
        this.called = null;

        const execFile = (...args: any[]) => {
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

    static finalize() {
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
            const ret = await mocked.getUbuntuVersion();
            A.ok(ret);
            A.equal(ret.description, 'Ubuntu 20.04.2 LTS');
            A.equal(ret.release, '20.04');
            A.equal(ret.codename, 'focal');
            A.deepEqual(ret.version, [20, 4, 2]);
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
            const ret = await mocked.getUbuntuVersion();
            A.ok(ret);
            A.equal(ret.description, 'Ubuntu 20.10.1');
            A.equal(ret.release, '20.10');
            A.equal(ret.codename, 'groovy');
            A.deepEqual(ret.version, [20, 10, 1]);
        });

        it('returns null with no distributor ID', async function () {
            const output = ['No LSB modules are available.'].join('\n');
            const mocked = new ExecFileMock(output);
            const ret = await mocked.getUbuntuVersion();
            A.equal(ret, null);
        });

        it('returns null when lsb_release is not found', async function () {
            // Pseudo SystemError since no constructor is public for the class
            const err = Object.assign(new Error(''), { errno: -2, code: 'ENOENT' });
            const mocked = new ExecFileMock(err);
            const ret = await mocked.getUbuntuVersion();
            A.equal(ret, null);
        });

        it('returns null on Linux other than Ubuntu', async function () {
            const output = [
                'LSB Version:	:base-4.0-ia32:base-4.0-noarch:core-4.0-ia32:core-4.0-noarch',
                'Distributor ID:	CentOS',
                'Description:	CentOS release 6.7 (Final)',
                'Release:	6.7',
                'Codename:	Final',
            ].join('\n');
            const mocked = new ExecFileMock(output);
            const ret = await mocked.getUbuntuVersion();
            A.equal(ret, null);
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
    });

    context('on non-Linux OSes', function () {
        after(function () {
            Object.defineProperty(process, 'platform', { value: savedPlatform });
        });

        for (const platform of ['darwin', 'windows']) {
            it(`returns null on ${platform}`, async function () {
                Object.defineProperty(process, 'platform', { value: platform });
                const ret = await getUbuntuVersion();
                A.equal(ret, null);
            });
        }
    });

    // More tests on CI for integration between system and this library
    const osName = process.env.TEST_CI_OS_NAME;
    if (osName?.startsWith('ubuntu-')) {
        it(`returns proper version info for '${osName}' on CI`, async function () {
            const [rel, code] = ((): [string, string] => {
                const ver = osName.slice('ubuntu-'.length);
                switch (ver) {
                    case 'latest':
                    case '20.04':
                        return ['20.04', 'focal'];
                    case '18.04':
                        return ['18.04', 'bionic'];
                    case '16.04':
                        return ['16.04', 'xenial'];
                    default:
                        throw new Error(`Unexpected OS: ${osName}`);
                }
            })();

            const ret = await getUbuntuVersion();
            A.ok(ret);

            const { description, release, codename } = ret;
            A.ok(description.includes(rel), description);
            A.equal(release, rel);
            A.equal(codename, code);

            // Check version prop
            {
                const got = ret.version;
                const want = rel.split('.').map(s => parseInt(s, 10));
                A.equal(want[0], got[0]);
                A.equal(want[1], got[1]);
                A.ok(description.includes(got[0].toString()));
                A.ok(description.includes(got[1].toString()));
                A.ok(release.includes(got[0].toString()));
                A.ok(release.includes(got[1].toString()));
            }
        });
    }
});

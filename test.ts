import { strict as A } from 'assert';
import { execSync } from 'child_process';
import { getUbuntuVersion } from '.';

function isUbuntu(): boolean {
    if (process.platform !== 'linux') {
        return false;
    }
    const stdout = execSync('lsb_release -a', { encoding: 'utf8' });
    return /Distributor ID:\s*Ubuntu/.test(stdout);
}

describe('getUbuntuVersion()', function () {
    if (isUbuntu()) {
        it('should return Ubuntu version info for Ubuntu', async function () {
            const ret = await getUbuntuVersion();
            A.ok(ret);

            const { description, release, codename, version } = ret;
            const msg = JSON.stringify({ description, release, codename, version });
            A.ok(description, msg);
            A.ok(release, msg);
            A.ok(codename, msg);
            A.ok(version.length >= 2, msg);

            A.ok(description.includes('Ubuntu'), msg); // e.g. "Ubuntu 18.04 LTS"
            A.ok(/^\d+\.\d+$/.test(release), msg); // e.g. "18.04"
            A.ok(description.includes(release), msg);
            A.ok(/^[a-zA-Z]+$/.test(codename), msg); // e.g. "bionic"
            const verString = `${version[0]}.${version[1].toString().padStart(2, '0')}`;
            A.ok(description.includes(verString));
            A.ok(release.startsWith(verString));
        });
    } else {
        it('should return null for OSes other than Ubuntu', async function () {
            const ret = await getUbuntuVersion();
            A.equal(ret, null);
        });
    }

    // More tests on CI for integration between system and this library
    const osName = process.env.TEST_CI_OS_NAME;
    if (osName?.startsWith('ubuntu-')) {
        it(`returns proper version info for '${osName}' on CI`, async function () {
            const [ver, code] = ((): [string, string] => {
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
            A.ok(description.includes(ver), description);
            A.equal(release, ver);
            A.equal(codename, code);

            const verArr = ret.version;
            A.ok(verArr.length >= 2);
            const [major, minor, patch] = verArr;
            let version = `${major}.${minor.toString().padStart(2, '0')}`;
            if (patch) {
                version = `${version}.${patch}`;
            }
            A.ok(version.startsWith(ver), `wanted ${ver} in ${version}`);
        });
    }
});

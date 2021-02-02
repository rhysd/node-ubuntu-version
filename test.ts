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
            const msg = JSON.stringify(ret);
            A.ok(ret);

            const { description, release, codename } = ret;
            A.ok(description, msg);
            A.ok(release, msg);
            A.ok(codename, msg);

            A.ok(description.includes('Ubuntu'), msg); // e.g. "Ubuntu 18.04 LTS"
            A.ok(/^\d+\.\d+$/.test(release), msg); // e.g. "18.04"
            A.ok(description.includes(release), msg);
            A.ok(/^[a-zA-Z]+$/.test(codename), msg); // e.g. "bionic"
        });
    } else {
        it('should return null for OSes other than Ubuntu', async function () {
            const ret = await getUbuntuVersion();
            A.equal(ret, null);
        });
    }

    const osName = process.env.TEST_CI_OS_NAME;
    if (osName && osName.startsWith('ubuntu-')) {
        it(`returns proper version info for '${osName}' on CI`, async function () {
            const [ver, code] = (() => {
                const ver = osName.slice('ubuntu-'.length);
                switch (ver) {
                    case 'latest':
                    case '20.04':
                        return ['20.04', 'forcal'];
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
        });
    }
});

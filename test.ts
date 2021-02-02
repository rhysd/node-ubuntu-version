import { strict as A } from 'assert';
import { getUbuntuVersion } from '.';

describe('getUbuntuVersion()', function () {
    it('is ok', function () {
        A.ok(getUbuntuVersion);
    });
});

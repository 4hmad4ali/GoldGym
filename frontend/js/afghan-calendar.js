/* Solar Hijri (Afghanistan) date helpers.
 * Database values remain ISO Gregorian (YYYY-MM-DD); the user only sees and
 * enters Solar Hijri dates (YYYY/MM/DD). */
(function () {
    var formatter = new Intl.DateTimeFormat('fa-AF-u-ca-persian-nu-latn', {
        calendar: 'persian', numberingSystem: 'latn', timeZone: 'UTC',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });

    function partsFor(date) {
        var parts = formatter.formatToParts(date), result = {};
        parts.forEach(function (part) { if (part.type !== 'literal') result[part.type] = part.value; });
        return result.year + '/' + result.month + '/' + result.day;
    }
    function latin(value) {
        return String(value || '').replace(/[۰-۹]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); })
            .replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); });
    }
    function isoDate(value) { return String(value || '').slice(0, 10); }

    window.afghanDate = function (value) {
        var iso = isoDate(value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value || '';
        var bits = iso.split('-');
        return partsFor(new Date(Date.UTC(+bits[0], +bits[1] - 1, +bits[2])));
    };
    window.afghanToday = function () { return window.afghanDate(new Date().toISOString()); };
    window.afghanDateToIso = function (value) {
        var match = latin(value).trim().match(/^(\d{3,4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
        if (!match) return '';
        var wanted = (+match[1]).toString().padStart(4, '0') + '/' + (+match[2]).toString().padStart(2, '0') + '/' + (+match[3]).toString().padStart(2, '0');
        // A Solar Hijri year overlaps roughly Gregorian year +621. Search the
        // small surrounding range instead of relying on a fragile date formula.
        var start = Date.UTC(+match[1] + 620, 0, 1), end = Date.UTC(+match[1] + 623, 0, 1);
        while (start <= end) {
            var middle = start + Math.floor((end - start) / 172800000) * 86400000;
            var found = partsFor(new Date(middle));
            if (found === wanted) return new Date(middle).toISOString().slice(0, 10);
            if (found < wanted) start = middle + 86400000; else end = middle - 86400000;
        }
        return '';
    };
    window.setAfghanDate = function (id, iso) { var el = document.getElementById(id); if (el) el.value = window.afghanDate(iso); };
    window.getAfghanDate = function (id) { var el = document.getElementById(id); return el ? window.afghanDateToIso(el.value) : ''; };
})();

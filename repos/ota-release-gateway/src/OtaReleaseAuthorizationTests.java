public class OtaReleaseAuthorizationTests {
    static void check(boolean ok, String msg) { if (!ok) throw new AssertionError(msg); }

    static boolean denied(OtaReleaseService s, OtaReleaseService.Operator actor, OtaReleaseService.Release r) {
        try { s.approve(actor, r); return false; }
        catch (SecurityException expected) { return true; }
    }

    public static void main(String[] args) {
        OtaReleaseService s = new OtaReleaseService();
        OtaReleaseService.Release r = new OtaReleaseService.Release("synthetic-ota-2", "canary", false);

        check(denied(s, null, r), "missing actor must be denied");
        System.out.println("PASS missing actor denied");
        check(denied(s, new OtaReleaseService.Operator("user-c", null), r), "missing role must be denied");
        System.out.println("PASS missing role denied");
        check(denied(s, new OtaReleaseService.Operator("user-d", "Release-Manager"), r), "unrecognized role must be denied");
        System.out.println("PASS unrecognized role denied");

        OtaReleaseService.Release approved = s.approve(new OtaReleaseService.Operator("user-a", "release-manager"), r);
        check(approved.approved() && approved.id().equals(r.id()) && approved.stage().equals(r.stage()), "manager approval keeps id and stage");
        check(!r.approved(), "input release must not be modified");
        System.out.println("PASS manager approval preserves release metadata");
    }
}

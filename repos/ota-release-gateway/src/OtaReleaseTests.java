public class OtaReleaseTests {
    static void check(boolean ok, String msg) { if (!ok) throw new AssertionError(msg); }
    public static void main(String[] args) {
        OtaReleaseService s = new OtaReleaseService();
        OtaReleaseService.Release r = new OtaReleaseService.Release("synthetic-ota-1", "canary", false);
        check(s.approve(new OtaReleaseService.Operator("user-a", "release-manager"), r).approved(), "manager must approve");
        System.out.println("PASS manager approval");
        boolean denied = false;
        try { s.approve(new OtaReleaseService.Operator("user-b", "viewer"), r); }
        catch (SecurityException expected) { denied = true; }
        check(denied, "non-manager approval must be denied");
        System.out.println("PASS viewer denied");
    }
}

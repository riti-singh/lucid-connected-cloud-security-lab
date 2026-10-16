public class OtaReleaseService {
    public record Operator(String id, String role) {}
    public record Release(String id, String stage, boolean approved) {}

    static final String RELEASE_MANAGER_ROLE = "release-manager";

    public Release approve(Operator actor, Release release) {
        if (actor == null || !RELEASE_MANAGER_ROLE.equals(actor.role())) {
            throw new SecurityException("release-manager role required to approve OTA release");
        }
        return new Release(release.id(), release.stage(), true);
    }
}

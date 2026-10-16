public class OtaReleaseService {
    public record Operator(String id, String role) {}
    public record Release(String id, String stage, boolean approved) {}

    public Release approve(Operator actor, Release release) {
        // Intentionally missing release-manager authorization.
        return new Release(release.id(), release.stage(), true);
    }
}

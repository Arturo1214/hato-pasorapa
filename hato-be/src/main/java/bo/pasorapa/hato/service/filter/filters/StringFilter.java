package bo.pasorapa.hato.service.filter.filters;

import io.quarkus.runtime.annotations.RegisterForReflection;
import java.util.Objects;

@RegisterForReflection
public class StringFilter extends Filter<String> {

    private String contains;

    public String getContains() {
        return contains;
    }

    public void setContains(String contains) {
        this.contains = contains;
    }

    @Override
    public boolean hasValues() {
        return super.hasValues() || contains != null;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass() || !super.equals(o)) {
            return false;
        }
        StringFilter that = (StringFilter) o;
        return Objects.equals(contains, that.contains);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), contains);
    }
}

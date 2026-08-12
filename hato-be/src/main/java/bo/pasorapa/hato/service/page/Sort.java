package bo.pasorapa.hato.service.page;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public class Sort {

    public enum Direction {
        ASC,
        DESC
    }

    private final List<Order> orders;

    public Sort() {
        this.orders = new ArrayList<>();
    }

    public Sort(List<Order> orders) {
        this.orders = orders;
    }

    public List<Order> getOrders() {
        return orders;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Sort sort = (Sort) o;
        return Objects.equals(orders, sort.orders);
    }

    @Override
    public int hashCode() {
        return Objects.hash(orders);
    }

    @RegisterForReflection
    public static class Order {

        private final Direction direction;
        private final String property;

        public Order(Direction direction, String property) {
            if (property == null || property.isBlank()) {
                throw new IllegalArgumentException("La propiedad de ordenamiento es obligatoria");
            }
            this.direction = direction;
            this.property = property;
        }

        public Direction getDirection() {
            return direction;
        }

        public String getProperty() {
            return property;
        }
    }
}

